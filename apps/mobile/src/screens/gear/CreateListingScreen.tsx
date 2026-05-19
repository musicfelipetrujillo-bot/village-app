// V4 Phase G4 — Create gear listing. Extended in G5 with:
//   * Barcode scan → Go-UPC/UPCitemdb lookup → pre-fill fields + capture upc
//   * AI vision identify → Claude Haiku multimodal → pre-fill fields
//   * Mandatory CPSC recall check before insert — blocks the flow if recalled
//
// Prohibited items are excluded at the DB enum level — the UI cannot even name them.
// Image upload targets Supabase Storage bucket `gear-listings` (create via Supabase dashboard).
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image,
  Alert, ActivityIndicator, Switch, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import {
  gearApi,
  categoryLabel,
  conditionLabel,
  requiresYearManufactured,
  SUBCATEGORIES_BY_CATEGORY,
  PROHIBITED_CATEGORIES,
  logGearEvent,
  type GearCategory,
  type GearCondition,
  type CpscRecallSummary,
  type VisionIdentifyResult,
  type ProhibitedCategory,
} from '@api/gear';
import type { AgeTag } from '@api/events';
import BarcodeScannerModal from '@components/gear/BarcodeScannerModal';
import CPSCRecallBlockModal from '@components/gear/CPSCRecallBlockModal';
import ProhibitedItemBlockModal from '@components/gear/ProhibitedItemBlockModal';

// Per-photo vision-identify cache value. Photos newly added are immediately
// kicked off in the background as 'pending'; the auto-run finishes silently
// (or surfaces in `identifyFromPhoto` if the user opens that flow). The cache
// is the source of truth the submit-time prohibited-item gate reads from.
type VisionCacheValue = 'pending' | 'failed' | VisionIdentifyResult;

const CATEGORIES: GearCategory[] = [
  'stroller', 'carrier_wrap', 'high_chair', 'bouncer_swing', 'toy',
  'feeding_gear', 'clothing', 'book', 'activity_center', 'nursery_furniture',
];
const CONDITIONS: GearCondition[] = ['new', 'like_new', 'good', 'fair'];
const AGE_TAGS: AgeTag[] = ['pregnancy', '0-3mo', '3-6mo', '6-12mo', '12mo+'];

const MAX_IMAGES = 5;

export default function CreateListingScreen() {
  const t = useT();
  const navigation = useNavigation<any>();

  const [category, setCategory] = useState<GearCategory | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [condition, setCondition] = useState<GearCondition>('good');
  const [ageTags, setAgeTags] = useState<AgeTag[]>([]);
  const [isFree, setIsFree] = useState(false);
  const [priceDollars, setPriceDollars] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupZip, setPickupZip] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Upload progress is shown under the submit button so the seller knows the
  // app didn't freeze when posting a 5-photo listing on slow networks. We track
  // current/total instead of percent because images upload sequentially and
  // each one is its own atomic boundary.
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // G5 state: scanner + vision + CPSC block + prohibited block.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [upc, setUpc] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const [recall, setRecall] = useState<{ productName: string; recall: CpscRecallSummary | null } | null>(null);
  // Optional product-catalog image returned by Go-UPC / UPCitemdb when the
  // seller scans a UPC. Persisted on the listing row (migration 064) so it
  // can be surfaced in the detail view as a "Product reference" card next
  // to the seller's actual photos. NULL when no UPC was scanned or the
  // lookup didn't return an image. Truth-in-listing posture: the user's
  // own photos remain primary; this is a labeled secondary reference.
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  // Per-photo vision results, keyed by local URI. Populated automatically
  // when a photo is added (background) and read by the submit-time gate.
  // Also used by `identifyFromPhoto` to avoid re-running a check on the
  // same image the auto-run already covered.
  const [visionByUri, setVisionByUri] = useState<Record<string, VisionCacheValue>>({});
  // Hard-block modal state. Set when a photo identifies as a prohibited
  // category at confidence ≥ 0.6 (server-side threshold applied in the
  // edge fn — if the field is set at all, we trust it).
  const [prohibitedBlock, setProhibitedBlock] = useState<{
    category: ProhibitedCategory;
    identifiedName: string | null;
  } | null>(null);

  const yearRequired = category ? requiresYearManufactured(category, subcategory) : false;

  const fetchLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(t('gearCreate.errLocationTitle'), t('gearCreate.errLocationBody'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      });
      if (geocode[0]) {
        if (!pickupCity && geocode[0].city) setPickupCity(geocode[0].city);
        if (!pickupZip && geocode[0].postalCode) setPickupZip(geocode[0].postalCode);
      }
    } catch (err) {
      console.error('[createListing] location', err);
    }
  };

  // Shared base64 + vision-identify helper. Returns the result; the caller
  // decides what to do with it. Throws on error so the caller can fail-open
  // or surface the error to the user as appropriate.
  const runVisionOnPhoto = async (uri: string): Promise<VisionIdentifyResult> => {
    const res = await fetch(uri);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('read failed'));
      reader.readAsDataURL(blob);
    });
    const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' =
      uri.toLowerCase().endsWith('.png') ? 'image/png'
      : uri.toLowerCase().endsWith('.webp') ? 'image/webp'
      : 'image/jpeg';
    return gearApi.visionIdentify({ image_base64: base64, image_media_type: mediaType });
  };

  // Background auto-fire: kicks off vision-identify on a newly added photo
  // and writes the verdict to the cache. Silent — no autofill side effects
  // (those happen only when the user explicitly opens "Identify from photo").
  // The cache feeds the submit-time prohibited-item gate.
  const kickOffBackgroundVision = (uri: string) => {
    setVisionByUri((prev) => ({ ...prev, [uri]: 'pending' }));
    runVisionOnPhoto(uri)
      .then((r) => {
        setVisionByUri((prev) => ({ ...prev, [uri]: r }));
        // Telemetry: when the prohibited gate catches something at the photo-add
        // moment (before submit), log it. Some sellers will close the modal
        // and walk away; some will retry with a different category — both
        // outcomes are interesting for compliance reporting.
        if (r.prohibited_category) {
          logGearEvent('gear_vision_prohibited_identified', {
            prohibited_category: r.prohibited_category,
            confidence: r.confidence,
            identified_name: r.name || null,
          }).catch(() => {});
        }
      })
      .catch(() => {
        setVisionByUri((prev) => ({ ...prev, [uri]: 'failed' }));
      });
  };

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(t('gearCreate.errLimitTitle'), t('gearCreate.errLimitBody', { max: MAX_IMAGES }));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('gearCreate.errPhotosTitle'), t('gearCreate.errPhotosBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (result.canceled) return;
    const newUris = result.assets.map((a) => a.uri);
    setImages((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
    // Fire background vision on every newly added photo. Don't block the UI.
    newUris.forEach((uri) => kickOffBackgroundVision(uri));
  };

  // ── G5: Barcode + UPC lookup ────────────────────────────────────────────────
  const onBarcodeScanned = async (code: string) => {
    setScannerOpen(false);
    setUpc(code);
    setLookupBusy(true);
    setAutofillNote(null);
    try {
      const r = await gearApi.upcLookup(code);
      logGearEvent('gear_barcode_scanned', {
        upc: code,
        found: r.found,
        source: r.found ? r.source : null,
      }).catch(() => {});
      if (!r.found) {
        setAutofillNote(
          r.reason === 'no_api_keys'
            ? t('gearCreate.noteSavedNoApi')
            : t('gearCreate.noteSavedNoMatch'),
        );
      } else {
        if (r.name && !title) setTitle(r.name.slice(0, 80));
        if (r.brand && !brand) setBrand(r.brand);
        // Capture the catalog image URL so it persists onto the new listing
        // as a "Product reference" card in the detail view (migration 064).
        // Only set if we don't already have one — barcode scans on a fresh
        // listing should populate it, but if the seller re-scans we don't
        // want to flip the stored reference around mid-edit.
        if (r.image_url && !referenceImageUrl) setReferenceImageUrl(r.image_url);
        setAutofillNote(t('gearCreate.noteFilledFrom', {
          label: r.source === 'go-upc' ? 'Go-UPC' : 'UPCitemdb',
          source: r.source ?? '',
        }));
      }
    } catch (err: any) {
      setAutofillNote(t('gearCreate.noteLookupFailed', { message: err?.message ?? t('gearCreate.noteLookupFailedDefault') }));
    } finally {
      setLookupBusy(false);
    }
  };

  // ── G5: AI Vision identify (uses first selected photo) ──────────────────────
  // Reads the cached result populated by kickOffBackgroundVision when the
  // photo was added. If the cache is missing or stale ('failed'), fires fresh.
  const identifyFromPhoto = async () => {
    if (images.length === 0) {
      Alert.alert(t('gearCreate.addPhotoFirstTitle'), t('gearCreate.addPhotoFirstBody'));
      return;
    }
    setVisionBusy(true);
    setAutofillNote(null);
    try {
      const uri = images[0];
      const cached = visionByUri[uri];
      let r: VisionIdentifyResult;
      if (cached && cached !== 'pending' && cached !== 'failed') {
        r = cached;
      } else {
        // Either never started, failed, or still in-flight — fire fresh.
        // For the autofill path we don't want to wait on a pending background
        // call (could be slow), so we just re-run.
        r = await runVisionOnPhoto(uri);
        setVisionByUri((prev) => ({ ...prev, [uri]: r }));
      }

      logGearEvent('gear_vision_identified', {
        confidence: r.confidence,
        has_name: !!r.name,
        category_hint: r.category_hint ?? null,
        prohibited_category: r.prohibited_category ?? null,
      }).catch(() => {});

      // If the photo is a prohibited item, the autofill flow is meaningless —
      // surface the hard-block modal here too so the user sees the same
      // outcome whether they hit "Identify" or just hit submit.
      if (r.prohibited_category) {
        setProhibitedBlock({ category: r.prohibited_category, identifiedName: r.name || null });
        logGearEvent('gear_prohibited_block_shown', {
          prohibited_category: r.prohibited_category,
          source: 'identify_button',
        }).catch(() => {});
        return;
      }

      if (r.confidence <= 0 || !r.name) {
        setAutofillNote(t('gearCreate.noteVisionFailedItem'));
      } else {
        if (r.name && !title) setTitle(r.name.slice(0, 80));
        if (r.brand && !brand) setBrand(r.brand);
        if (r.category_hint && !category) { setCategory(r.category_hint); setSubcategory(null); }
        if (r.subcategory_hint && !subcategory) setSubcategory(r.subcategory_hint);
        if (r.condition_hint) setCondition(r.condition_hint);
        const pct = Math.round(r.confidence * 100);
        setAutofillNote(t('gearCreate.noteVisionConfidence', { pct }));
      }
    } catch (err: any) {
      setAutofillNote(t('gearCreate.noteVisionFailed', { message: err?.message ?? t('gearCreate.noteLookupFailedDefault') }));
    } finally {
      setVisionBusy(false);
    }
  };

  const removeImage = (uri: string) => setImages((prev) => prev.filter((u) => u !== uri));

  const toggleAgeTag = (tag: AgeTag) => {
    setAgeTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const uploadImage = async (localUri: string, userId: string): Promise<string> => {
    const ext = (localUri.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/\?.*$/, '');
    const key = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    // RN-safe path: fetch local URI → arrayBuffer → upload bytes.
    const res = await fetch(localUri);
    const buf = await res.arrayBuffer();
    const { error } = await supabase.storage
      .from('gear-listings')
      .upload(key, buf, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: false,
      });
    if (error) throw new Error(`Image upload failed: ${error.message}`);
    const { data: pub } = supabase.storage.from('gear-listings').getPublicUrl(key);
    return pub.publicUrl;
  };

  const validate = (): string | null => {
    if (!category) return t('gearCreate.errPickCategory');
    if (title.trim().length < 4) return t('gearCreate.errTitleShort');
    if (description.trim().length < 20) return t('gearCreate.errDescShort');
    if (yearRequired) {
      const y = Number(year);
      if (!Number.isInteger(y)) return t('gearCreate.errYearRequired');
      if (category === 'toy' && y < 1978) return t('gearCreate.errYearToy');
      if (category === 'nursery_furniture' && subcategory === 'crib' && y < 2011) {
        return t('gearCreate.errYearCrib');
      }
    }
    if (ageTags.length === 0) return t('gearCreate.errAgeRequired');
    if (!isFree) {
      const dollars = Number(priceDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) return t('gearCreate.errPriceInvalid');
    }
    if (pickupCity.trim().length < 2) return t('gearCreate.errCityRequired');
    if (!coords) return t('gearCreate.errLocationRequired');
    if (images.length === 0) return t('gearCreate.errPhotosRequired');
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert(t('gearCreate.errFixTitle'), err); return; }
    if (!category) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // ── G5 gate #1: Prohibited-item check on EVERY uploaded photo.
      // Runs before the CPSC check + before any storage upload + before
      // the row insert. Reads the per-photo cache populated when each
      // photo was added; awaits any 'pending' background calls (8s ceiling
      // per photo) and re-runs anything in 'failed' state. If any photo
      // identifies as a prohibited_category (server-side already gated
      // by confidence ≥ 0.6), hard-block via ProhibitedItemBlockModal.
      //
      // Fail-open posture: if a photo's vision call genuinely cannot
      // complete (network outage, Anthropic API down), we log the gap
      // to analytics for compliance audit and let the submission proceed.
      // The nightly compliance sweep + the post-listing reactive moderator
      // queue catch what slips through. Same posture as the CPSC fail-open
      // immediately below.
      for (const uri of images) {
        let v = visionByUri[uri];
        if (v === 'pending') {
          // Race the in-flight background call against an 8s timeout.
          v = await new Promise<VisionCacheValue>((resolve) => {
            const start = Date.now();
            const poll = () => {
              const current = visionByUri[uri];
              if (current && current !== 'pending') { resolve(current); return; }
              if (Date.now() - start > 8000) { resolve('failed'); return; }
              setTimeout(poll, 250);
            };
            poll();
          });
        }
        if (v === 'failed' || v === undefined) {
          // Re-run inline. If THIS fails too, fail open and log.
          try {
            v = await runVisionOnPhoto(uri);
            setVisionByUri((prev) => ({ ...prev, [uri]: v as VisionIdentifyResult }));
          } catch {
            logGearEvent('gear_vision_check_failed', {
              uri_hash: String(uri.length), // don't log the URI itself
              stage: 'submit_gate',
            }).catch(() => {});
            continue;
          }
        }
        if (v && typeof v === 'object' && v.prohibited_category) {
          setProhibitedBlock({
            category: v.prohibited_category,
            identifiedName: v.name || null,
          });
          logGearEvent('gear_prohibited_block_shown', {
            prohibited_category: v.prohibited_category,
            source: 'submit_gate',
          }).catch(() => {});
          setSubmitting(false);
          return;
        }
      }

      // ── G5 gate #2: CPSC recall check BEFORE we upload photos or insert anything.
      // Fail-open only on status='unknown' (API down) — per the Edge Fn contract
      // we still allow posting in that case but the listing won't get the badge.
      // status='recalled' is a hard block.
      const check = await gearApi.cpscCheck({
        product_name: title.trim(),
        brand: brand.trim() || null,
        upc: upc,
      });
      logGearEvent('gear_cpsc_check_result', {
        status: check.status,
        has_upc: !!upc,
        recall_number: check.recall?.recall_number ?? null,
      }).catch(() => {});
      if (check.status === 'recalled') {
        logGearEvent('gear_cpsc_block_shown', {
          recall_number: check.recall?.recall_number ?? null,
          product_name: title.trim(),
        }).catch(() => {});
        setRecall({ productName: title.trim(), recall: check.recall ?? null });
        setSubmitting(false);
        return;
      }

      const uploaded: string[] = [];
      setUploadProgress({ current: 0, total: images.length });
      for (let i = 0; i < images.length; i++) {
        setUploadProgress({ current: i + 1, total: images.length });
        const url = await uploadImage(images[i], user.id);
        uploaded.push(url);
      }
      setUploadProgress(null);

      const { id } = await gearApi.createListing({
        category,
        subcategory: subcategory ?? null,
        title: title.trim(),
        description: description.trim(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        year_manufactured: yearRequired ? Number(year) : null,
        condition,
        age_tags: ageTags,
        price_cents: isFree ? 0 : Math.round(Number(priceDollars) * 100),
        is_free: isFree,
        pickup_city: pickupCity.trim(),
        pickup_zip: pickupZip.trim() || null,
        lat: coords!.lat,
        lng: coords!.lng,
        image_urls: uploaded,
        reference_image_url: referenceImageUrl,
      });

      // Persist the verdict onto the new listing row (owner-scoped RPC).
      // We do this post-insert because mark_listing_cpsc needs a listing id.
      // Fire-and-forget: any failure just leaves status NULL — nightly sweep
      // will handle it. We do NOT block the success UX on this.
      gearApi.cpscCheck({
        product_name: title.trim(),
        brand: brand.trim() || null,
        upc: upc,
        listing_id: id,
      }).catch((e) => console.warn('[createListing] post-insert cpsc persist', e));

      logGearEvent('gear_listing_created', {
        listing_id: id,
        category,
        has_upc: !!upc,
        is_free: isFree,
        image_count: uploaded.length,
        year_manufactured: yearRequired ? Number(year) : null,
      }).catch(() => {});

      Alert.alert(t('gearCreate.successTitle'), t('gearCreate.successBody'), [
        { text: t('gearCreate.successView'), onPress: () => navigation.replace('GearListingDetail', { id }) },
      ]);
    } catch (err: any) {
      Alert.alert(t('gearCreate.errCouldNotPost'), err?.message ?? t('gearCreate.errTryAgain'));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('gearCreate.cancelA11y')}
        >
          <Text style={styles.back}>{t('gearCreate.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('gearCreate.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.prohibitedBlock}>
          <Text style={styles.prohibitedTitle}>{t('gearCreate.prohibitedTitle')}</Text>
          <Text style={styles.prohibitedBody}>
            {t('gearCreate.prohibitedBody1')}
            <Text style={styles.prohibitedLink} onPress={() => Linking.openURL('https://cpsc.gov/Recalls')}>
              {t('gearCreate.prohibitedLink')}
            </Text>
            {t('gearCreate.prohibitedBody2')}
          </Text>
        </View>

        {/* G5: speed up listing via barcode or AI vision */}
        <View style={styles.quickFillRow}>
          <TouchableOpacity
            style={[styles.quickFillBtn, lookupBusy && { opacity: 0.6 }]}
            onPress={() => setScannerOpen(true)}
            disabled={lookupBusy || visionBusy}
            accessibilityRole="button"
            accessibilityLabel={lookupBusy ? t('gearCreate.scanBarcodeA11yBusy') : t('gearCreate.scanBarcodeA11yIdle')}
            accessibilityState={{ busy: lookupBusy, disabled: lookupBusy || visionBusy }}
          >
            {lookupBusy ? <ActivityIndicator color="#C07840" /> : (
              <>
                <Text style={styles.quickFillIcon}>📷</Text>
                <Text style={styles.quickFillText}>{t('gearCreate.scanBarcode')}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickFillBtn,
              (images.length === 0 || visionBusy) && { opacity: 0.5 },
            ]}
            onPress={identifyFromPhoto}
            disabled={visionBusy || lookupBusy || images.length === 0}
            accessibilityRole="button"
            accessibilityLabel={
              images.length === 0
                ? t('gearCreate.identifyPhotoA11yEmpty')
                : visionBusy
                  ? t('gearCreate.identifyPhotoA11yBusy')
                  : t('gearCreate.identifyPhotoA11yIdle')
            }
            accessibilityState={{ disabled: images.length === 0, busy: visionBusy }}
          >
            {visionBusy ? <ActivityIndicator color="#C07840" /> : (
              <>
                <Text style={styles.quickFillIcon}>✨</Text>
                <Text style={styles.quickFillText}>{t('gearCreate.identifyPhoto')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {autofillNote ? (
          <Text style={styles.autofillNote}>{autofillNote}</Text>
        ) : null}
        {upc ? (
          <Text style={styles.upcTag}>{t('gearCreate.upcLabel', { upc })}</Text>
        ) : null}

        <Section title={t('gearCreate.sectionCategory')}>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => { setCategory(c); setSubcategory(null); }}
                accessibilityRole="button"
                accessibilityState={{ selected: category === c }}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {categoryLabel(c)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {category && SUBCATEGORIES_BY_CATEGORY[category].length > 0 && (
          <Section title={t('gearCreate.sectionType')}>
            <View style={styles.chipWrap}>
              {SUBCATEGORIES_BY_CATEGORY[category].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, subcategory === s && styles.chipActive]}
                  onPress={() => setSubcategory(subcategory === s ? null : s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: subcategory === s }}
                  accessibilityLabel={t('gearCreate.typeOptionA11y', { name: s })}
                >
                  <Text style={[styles.chipText, subcategory === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        )}

        <Section title={t('gearCreate.sectionPhotos')}>
          <View style={styles.photoRow}>
            {images.map((uri, idx) => (
              <View key={uri} style={styles.photoWrap}>
                <Image
                  source={{ uri }}
                  style={styles.photo}
                  accessible
                  accessibilityLabel={t('gearCreate.photoLabelA11y', { n: idx + 1, total: images.length })}
                />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removeImage(uri)}
                  accessibilityRole="button"
                  accessibilityLabel={t('gearCreate.removePhotoA11y', { n: idx + 1 })}
                >
                  <Text style={styles.photoRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity
                style={styles.photoAdd}
                onPress={pickImage}
                accessibilityRole="button"
                accessibilityLabel={t('gearCreate.addPhotoA11y', { current: images.length, max: MAX_IMAGES })}
              >
                <Text style={styles.photoAddIcon}>＋</Text>
                <Text style={styles.photoAddText}>{t('gearCreate.addPhotoLabel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>

        <Section title={t('gearCreate.sectionTitle')}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('gearCreate.titlePlaceholder')}
            placeholderTextColor={COLORS.textLight}
            maxLength={80}
          />
        </Section>

        <Section title={t('gearCreate.sectionDescription')}>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('gearCreate.descriptionPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            multiline
            maxLength={1000}
          />
        </Section>

        <Section title={t('gearCreate.sectionBrandModel')}>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder={t('gearCreate.brandPlaceholder')}
            placeholderTextColor={COLORS.textLight}
          />
          <View style={{ height: 8 }} />
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder={t('gearCreate.modelPlaceholder')}
            placeholderTextColor={COLORS.textLight}
          />
        </Section>

        {yearRequired && (
          <Section title={t('gearCreate.sectionYear')}>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder={category === 'toy' ? t('gearCreate.yearPlaceholderToy') : t('gearCreate.yearPlaceholderCrib')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
              maxLength={4}
            />
          </Section>
        )}

        <Section title={t('gearCreate.sectionCondition')}>
          <View style={styles.chipWrap}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, condition === c && styles.chipActive]}
                onPress={() => setCondition(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: condition === c }}
              >
                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>
                  {conditionLabel(c)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title={t('gearCreate.sectionAge')}>
          <View style={styles.chipWrap}>
            {AGE_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.chip, ageTags.includes(tag) && styles.chipActive]}
                onPress={() => toggleAgeTag(tag)}
                accessibilityRole="button"
                accessibilityState={{ selected: ageTags.includes(tag) }}
              >
                <Text style={[styles.chipText, ageTags.includes(tag) && styles.chipTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title={t('gearCreate.sectionPrice')}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('gearCreate.freeLabel')}</Text>
            <Switch
              value={isFree}
              onValueChange={setIsFree}
              trackColor={{ true: COLORS.coco, false: '#CCC' }}
              accessibilityLabel={t('gearCreate.freeLabel')}
              accessibilityRole="switch"
              accessibilityState={{ checked: isFree }}
            />
          </View>
          {!isFree && (
            <View style={styles.priceInputRow}>
              <Text style={styles.priceCurrency}>$</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={priceDollars}
                onChangeText={setPriceDollars}
                placeholder={t('gearCreate.pricePlaceholder')}
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
              />
            </View>
          )}
        </Section>

        <Section title={t('gearCreate.sectionPickup')}>
          <TextInput
            style={styles.input}
            value={pickupCity}
            onChangeText={setPickupCity}
            placeholder={t('gearCreate.cityPlaceholder')}
            placeholderTextColor={COLORS.textLight}
          />
          <View style={{ height: 8 }} />
          <TextInput
            style={styles.input}
            value={pickupZip}
            onChangeText={setPickupZip}
            placeholder={t('gearCreate.zipPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            keyboardType="number-pad"
            maxLength={10}
          />
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={fetchLocation}
            accessibilityRole="button"
            accessibilityLabel={coords ? t('gearCreate.useLocationA11ySet') : t('gearCreate.useLocationA11yIdle')}
            accessibilityState={{ selected: !!coords }}
          >
            <Text style={styles.locationBtnText}>
              {coords ? t('gearCreate.locationSet') : t('gearCreate.useLocation')}
            </Text>
          </TouchableOpacity>
        </Section>

        <Text style={styles.legalNote}>
          {t('gearCreate.legalNote')}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={
            uploadProgress
              ? t('gearCreate.postA11yUploading', { current: uploadProgress.current, total: uploadProgress.total })
              : submitting
              ? t('gearCreate.postA11yBusy')
              : t('gearCreate.postA11y')
          }
          accessibilityState={{ disabled: submitting, busy: submitting }}
        >
          {submitting ? (
            <View style={styles.submitBusy}>
              <ActivityIndicator color="#FDFBF6" />
              {uploadProgress ? (
                <Text style={styles.submitProgressText}>
                  {t('gearCreate.uploadingText', { current: uploadProgress.current, total: uploadProgress.total })}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.submitBtnText}>{t('gearCreate.post')}</Text>
          )}
        </TouchableOpacity>
        {uploadProgress ? (
          <View
            style={styles.uploadTrack}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('gearCreate.uploadProgressA11y', { current: uploadProgress.current, total: uploadProgress.total })}
          >
            <View
              style={[
                styles.uploadFill,
                { width: `${(uploadProgress.current / uploadProgress.total) * 100}%` },
              ]}
            />
          </View>
        ) : null}
      </View>

      <BarcodeScannerModal
        visible={scannerOpen}
        onScan={onBarcodeScanned}
        onClose={() => setScannerOpen(false)}
      />
      <CPSCRecallBlockModal
        visible={recall !== null}
        productName={recall?.productName ?? title}
        recall={recall?.recall ?? null}
        onClose={() => setRecall(null)}
      />
      <ProhibitedItemBlockModal
        visible={prohibitedBlock !== null}
        prohibitedCategory={prohibitedBlock?.category ?? null}
        identifiedName={prohibitedBlock?.identifiedName ?? null}
        onClose={() => setProhibitedBlock(null)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

// Keep lint quiet — PROHIBITED_CATEGORIES is referenced as a design-time constant
// to make the compliance intent explicit in the file; enforcement is at the DB enum.
void PROHIBITED_CATEGORIES;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 14, color: '#C07840', fontFamily: FONTS.bodySemiBold, minWidth: 50 },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  content: { padding: 16, paddingBottom: 140 },

  prohibitedBlock: {
    backgroundColor: 'rgba(184,92,56,0.08)', borderRadius: 12,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.3)',
  },
  prohibitedTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#A77349', marginBottom: 4, letterSpacing: 0.4 },
  prohibitedBody: { fontSize: 12, color: COLORS.barkSoft, lineHeight: 18, fontFamily: FONTS.body },
  prohibitedLink: { color: '#C07840', fontFamily: FONTS.bodySemiBold, textDecorationLine: 'underline' },

  quickFillRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quickFillBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5, borderColor: 'rgba(184,92,56,0.35)',
  },
  quickFillIcon: { fontSize: 16 },
  quickFillText: { fontSize: 13, color: '#A77349', fontFamily: FONTS.bodySemiBold },
  autofillNote: {
    fontSize: 12, color: COLORS.barkSoft, marginTop: 8,
    fontStyle: 'italic', lineHeight: 17, fontFamily: FONTS.body,
  },
  upcTag: {
    marginTop: 6,
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.textLight,
    letterSpacing: 0.4,
  },

  section: { marginTop: 14 },
  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1,
    color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 8,
  },

  input: {
    backgroundColor: COLORS.paper, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, color: COLORS.bark,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
    fontFamily: FONTS.body,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)', backgroundColor: COLORS.paper,
  },
  chipActive: { backgroundColor: '#C07840', borderColor: '#C07840' },  // v9 CTA = cinnamon
  chipText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  chipTextActive: { color: '#FDFBF6' },                                // v9 no pure white

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#FDFBF6', fontSize: 16, lineHeight: 18, fontFamily: FONTS.bodySemiBold },
  photoAdd: {
    width: 84, height: 84, borderRadius: 10,
    backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(150,80,50,0.18)',
  },
  photoAddIcon: { fontSize: 22, color: '#A77349', fontFamily: FONTS.bodySemiBold },
  photoAddText: { fontSize: 11, color: COLORS.barkSoft, fontFamily: FONTS.bodySemiBold },

  // v9 card lift — soft drop so the price toggle reads as a discrete control.
  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.paper, borderRadius: 10, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#6B2E0E', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 1,
  },
  priceLabel: { fontSize: 14, color: COLORS.bark, fontFamily: FONTS.bodyMedium },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  priceCurrency: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },

  locationBtn: {
    backgroundColor: COLORS.paper, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)',
  },
  locationBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.cocoDeep },

  legalNote: {
    fontSize: 11, color: COLORS.textLight,
    marginTop: 20, lineHeight: 17, fontStyle: 'italic', fontFamily: FONTS.body,
  },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 28,
    backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  // v9 canonical CTA
  submitBtn: {
    backgroundColor: '#C07840', borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  submitBtnText: { color: '#FDFBF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
  submitBusy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitProgressText: { color: COLORS.bark, fontSize: 13, fontFamily: FONTS.bodyMedium },
  uploadTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginTop: 8,
    overflow: 'hidden',
  },
  uploadFill: {
    height: '100%',
    backgroundColor: '#C07840',                                        // v9 progress = cinnamon
  },
});
