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
} from '@api/gear';
import type { AgeTag } from '@api/events';
import BarcodeScannerModal from '@components/gear/BarcodeScannerModal';
import CPSCRecallBlockModal from '@components/gear/CPSCRecallBlockModal';

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

  // G5 state: scanner + vision + CPSC block.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [upc, setUpc] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const [recall, setRecall] = useState<{ productName: string; recall: CpscRecallSummary | null } | null>(null);

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
    setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
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
  const identifyFromPhoto = async () => {
    if (images.length === 0) {
      Alert.alert(t('gearCreate.addPhotoFirstTitle'), t('gearCreate.addPhotoFirstBody'));
      return;
    }
    setVisionBusy(true);
    setAutofillNote(null);
    try {
      const uri = images[0];
      // Convert the local URI to base64 so the Edge Fn can send it to Claude
      // without requiring us to upload to Storage first.
      const res = await fetch(uri);
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          // result looks like "data:image/jpeg;base64,<...>"
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('read failed'));
        reader.readAsDataURL(blob);
      });

      // Detect media type from the data URL we just built. Default jpeg.
      const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' =
        uri.toLowerCase().endsWith('.png') ? 'image/png'
        : uri.toLowerCase().endsWith('.webp') ? 'image/webp'
        : 'image/jpeg';

      const r = await gearApi.visionIdentify({
        image_base64: base64,
        image_media_type: mediaType,
      });

      logGearEvent('gear_vision_identified', {
        confidence: r.confidence,
        has_name: !!r.name,
        category_hint: r.category_hint ?? null,
      }).catch(() => {});
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

      // ── G5 gate: CPSC recall check BEFORE we upload photos or insert anything.
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
            {lookupBusy ? <ActivityIndicator color={COLORS.rust} /> : (
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
            {visionBusy ? <ActivityIndicator color={COLORS.rust} /> : (
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
              trackColor={{ true: COLORS.rust, false: '#CCC' }}
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
              <ActivityIndicator color="#FFF" />
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
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 14, color: COLORS.rust, fontFamily: FONTS.bodySemiBold, minWidth: 50 },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },

  content: { padding: 16, paddingBottom: 140 },

  prohibitedBlock: {
    backgroundColor: 'rgba(184,92,56,0.08)', borderRadius: 12,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.3)',
  },
  prohibitedTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark, marginBottom: 4, letterSpacing: 0.4 },
  prohibitedBody: { fontSize: 12, color: COLORS.textMid, lineHeight: 18, fontFamily: FONTS.body },
  prohibitedLink: { color: COLORS.rust, fontFamily: FONTS.bodySemiBold, textDecorationLine: 'underline' },

  quickFillRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quickFillBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1.5, borderColor: 'rgba(184,92,56,0.35)',
  },
  quickFillIcon: { fontSize: 16 },
  quickFillText: { fontSize: 13, color: COLORS.rustDark, fontFamily: FONTS.bodySemiBold },
  autofillNote: {
    fontSize: 12, color: COLORS.textMid, marginTop: 8,
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
    backgroundColor: '#FFF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, color: COLORS.brownDeep,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    fontFamily: FONTS.body,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#FFF',
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  chipText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },
  chipTextActive: { color: '#FFF' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#FFF', fontSize: 16, lineHeight: 18, fontFamily: FONTS.bodySemiBold },
  photoAdd: {
    width: 84, height: 84, borderRadius: 10,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.2)',
  },
  photoAddIcon: { fontSize: 22, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  photoAddText: { fontSize: 11, color: COLORS.textMid, fontFamily: FONTS.bodySemiBold },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  priceLabel: { fontSize: 14, color: COLORS.brownDeep, fontFamily: FONTS.bodyMedium },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  priceCurrency: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },

  locationBtn: {
    backgroundColor: '#FFF', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
  },
  locationBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.rustDark },

  legalNote: {
    fontSize: 11, color: COLORS.textLight,
    marginTop: 20, lineHeight: 17, fontStyle: 'italic', fontFamily: FONTS.body,
  },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 28,
    backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  submitBtn: {
    backgroundColor: COLORS.yolkLight, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
  },
  submitBtnText: { color: COLORS.brownDeep, fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
  submitBusy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitProgressText: { color: COLORS.brownDeep, fontSize: 13, fontFamily: FONTS.bodyMedium },
  uploadTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginTop: 8,
    overflow: 'hidden',
  },
  uploadFill: {
    height: '100%',
    backgroundColor: COLORS.rust,
  },
});
