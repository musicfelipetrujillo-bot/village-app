// DaySheetShareScreen — the handoff. QR (opens the live web page), a shareable
// link (text it), a PDF (print/save), plus a live preview and a revoke toggle.
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Share, Alert, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import { COLORS, FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { daySheetsApi, shareUrl, ROW_META, type DaySheet } from '@api/daySheets';

function pdfHtml(d: DaySheet): string {
  const esc = (x: unknown) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const kt = d.key_times || ({} as any);
  const ess = d.essentials || ({} as any);
  const rows = (d.schedule || []).map((r) => {
    const m = ROW_META[r.kind] || ROW_META.note;
    const bg = m.rowBg || 'transparent';
    const weight = m.rowBg ? 700 : 400;
    return `<tr style="background:${bg}">
      <td style="width:40px;padding:6px 0 6px 6px"><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:9px;background:${m.chip};font-size:15px">${m.emoji}</span></td>
      <td style="width:56px;font-weight:700;font-size:12px;color:${m.timeColor}">${esc(r.time)}</td>
      <td style="padding:6px 8px 6px 6px;font-size:13px;color:${m.textColor};font-weight:${weight}">${esc(r.text)}</td>
    </tr>`;
  }).join('');
  const ktRow = (k: string, v: string[]) => (v && v.length) ? `<b>${k}</b> ${esc(v.join(' · '))}<br>` : '';
  const feedTimes = (d.schedule || []).filter((r) => r.kind === 'bottle' || r.kind === 'meal').map((r) => r.time);
  const tips = (d.tips || []).filter((t) => (t.text || '').trim() || t.photo_url).map((t) =>
    `<div style="display:flex;gap:10px;margin:8px 0;background:#FDECEF;border-radius:10px;padding:10px">${t.photo_url ? `<img src="${esc(t.photo_url)}" style="width:70px;height:70px;object-fit:cover;border-radius:8px"/>` : '💡 '}<div>${esc(t.text)}</div></div>`).join('');
  return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{font-family:-apple-system,Helvetica,sans-serif;color:#3D2116;padding:22px}
    h1{font-size:26px;margin:0} .eye{letter-spacing:2px;text-transform:uppercase;font-size:11px;color:#B98A1E;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:13px} td{vertical-align:middle} h3{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A6A55;margin:18px 0 8px}
    .box{background:#FCEFC7;border-radius:12px;padding:12px;font-size:13px;line-height:1.6}
  </style></head><body>
    <div class="eye">day sheet</div><h1>${esc(d.baby_name || 'Baby')}'s day</h1>
    <div style="color:#7A5A3E;font-size:13px;margin-top:4px">${d.for_whom ? 'for <b>' + esc(d.for_whom) + '</b>' : ''} ${[d.starts_on, d.ends_on].filter(Boolean).join(' – ')}</div>
    <h3>★ key times</h3><div class="box">${ktRow('💤 naps', kt.naps)}${kt.bed ? `<b>🌙 bed</b> ${esc(kt.bed)}<br>` : ''}${ktRow('🍼 feeds', feedTimes)}</div>
    ${(ess.emergency || ess.allergies || ess.pediatrician || ess.comfort || ess.meds) ? `<h3>essentials</h3><div class="box">${['emergency', 'allergies', 'pediatrician', 'comfort', 'meds'].map((k) => (ess as any)[k] ? `<b>${k}:</b> ${esc((ess as any)[k])}<br>` : '').join('')}</div>` : ''}
    <h3>the full day</h3><table>${rows}</table>
    ${tips ? `<h3>pro tips from mom</h3>${tips}` : ''}
    <div style="text-align:center;color:#9A8264;font-size:11px;margin-top:24px">made with villie</div>
  </body></html>`;
}

export default function DaySheetShareScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const id: string = route.params?.id;
  const [d, setD] = useState<DaySheet | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { const s = await daySheetsApi.get(id); setD(s); if (s && !s.is_shared) daySheetsApi.update(id, { is_shared: true } as any); };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (!d) return <View style={[st.center, { flex: 1, backgroundColor: COLORS.v2_paper }]}><ActivityIndicator color={COLORS.v2_cinnamon} /></View>;

  const url = shareUrl(d.share_token);
  const revoked = !!d.revoked_at;

  const shareLink = async () => {
    try { await Share.share({ message: `Here's ${d.baby_name || 'baby'}'s day sheet — everything you need while I'm away: ${url}` }); } catch {}
  };
  const copyLink = async () => { await Clipboard.setStringAsync(url); Alert.alert('Link copied', 'Paste it anywhere to share.'); };
  const makePdf = async () => {
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: pdfHtml(d) });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (e) { Alert.alert('Could not make the PDF', 'Please try again.'); }
    setBusy(false);
  };
  const toggleRevoke = async () => {
    const next = revoked ? null : new Date().toISOString();
    await daySheetsApi.update(id, { revoked_at: next } as any);
    setD((p) => (p ? { ...p, revoked_at: next } : p));
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.v2_paper }}>
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <BackButton color={COLORS.v2_cinnamon} />
        <Text style={st.headTitle}>Share</Text>
        <TouchableOpacity onPress={() => nav.navigate('DaySheetBuilder', { id })}><Text style={st.edit}>Edit</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
        {/* QR */}
        <View style={st.qrCard}>
          <View style={{ opacity: revoked ? 0.25 : 1 }}>
            <QRCode value={url} size={172} color="#3D2116" backgroundColor="#FFFFFF" />
          </View>
          <Text style={st.qrTitle}>{revoked ? 'Link is off' : 'Scan to open on their phone'}</Text>
          <Text style={st.qrSub}>{revoked ? 'Turn it back on to share again.' : 'Live sheet — always up to date. No app needed.'}</Text>
        </View>

        {/* actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity style={[st.act, { backgroundColor: COLORS.v2_cinnamon }]} onPress={shareLink} disabled={revoked}><Text style={[st.actTxt, { color: '#fff' }]}>Text the link</Text></TouchableOpacity>
          <TouchableOpacity style={st.actOut} onPress={copyLink} disabled={revoked}><Text style={st.actOutTxt}>Copy</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={st.pdf} onPress={makePdf} disabled={busy}>
          <Text style={st.pdfTxt}>{busy ? 'Making PDF…' : '⬇  Download / print PDF'}</Text>
        </TouchableOpacity>

        {/* live preview */}
        <Text style={st.section}>Preview</Text>
        <View style={st.doc}>
          <Text style={st.docName}>{d.baby_name || 'Baby'}'s day</Text>
          <Text style={st.docFor}>{d.for_whom ? `for ${d.for_whom}` : ''}{[d.starts_on, d.ends_on].filter(Boolean).length ? ` · ${[d.starts_on, d.ends_on].filter(Boolean).join(' – ')}` : ''}</Text>
          {(d.schedule || []).map((r, i) => {
            const m = ROW_META[r.kind] || ROW_META.note;
            return (
              <View key={i} style={[st.row, m.rowBg ? { backgroundColor: m.rowBg } : null]}>
                <View style={[st.chip, { backgroundColor: m.chip }]}><Text style={{ fontSize: 15 }}>{m.emoji}</Text></View>
                <Text style={[st.rowT, { color: m.timeColor }]}>{r.time}</Text>
                <Text style={[st.rowW, { color: m.textColor, fontFamily: m.rowBg ? FONTS.bodySemiBold : FONTS.v2_body }]}>{r.text}</Text>
              </View>
            );
          })}
          {(d.tips || []).filter((t) => t.text || t.photo_url).map((t, i) => (
            <View key={i} style={st.tip}>
              {t.photo_url ? <Image source={{ uri: t.photo_url }} style={st.tipImg} /> : <Text style={{ fontSize: 16 }}>💡</Text>}
              <Text style={st.tipTxt}>{t.text}</Text>
            </View>
          ))}
        </View>

        {/* revoke */}
        <TouchableOpacity style={st.revoke} onPress={toggleRevoke}>
          <Text style={[st.revokeTxt, { color: revoked ? COLORS.v2_cinnamon : '#B7A692' }]}>{revoked ? '↺  Turn the link back on' : '⦸  Turn off this link'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)' },
  back: { fontFamily: FONTS.v2_link, fontSize: 15, color: COLORS.v2_cinnamon },
  headTitle: { fontFamily: FONTS.v3_display, fontSize: 18, color: COLORS.v2_cocoa },
  edit: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.v2_cinnamon },
  qrCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)' },
  qrTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.v2_cocoa, marginTop: 16 },
  qrSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.v2_walnut, marginTop: 4, textAlign: 'center' },
  act: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 14 },
  actOut: { paddingHorizontal: 20, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDECEF' },
  actOutTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.v2_cinnamon },
  pdf: { marginTop: 10, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FFFCF6', borderWidth: 1, borderColor: 'rgba(61,31,14,0.1)' },
  pdfTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.v2_cocoa },
  section: { fontFamily: FONTS.v3_display, fontSize: 19, color: COLORS.v2_cocoa, marginTop: 24, marginBottom: 10 },
  doc: { backgroundColor: '#FFFDF9', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)' },
  docName: { fontFamily: FONTS.v3_display, fontSize: 22, color: COLORS.v2_cocoa },
  docFor: { fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.v2_walnut, marginTop: 2, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 11, marginTop: 4 },
  chip: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowT: { width: 52, fontFamily: FONTS.v2_mono, fontSize: 11, fontWeight: '700' },
  rowW: { flex: 1, fontSize: 12.5 },
  tip: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: '#FDECEF', borderRadius: 10, padding: 9, marginTop: 6 },
  tipImg: { width: 44, height: 44, borderRadius: 7 },
  tipTxt: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12, color: COLORS.v2_cocoa, lineHeight: 16 },
  revoke: { alignItems: 'center', marginTop: 22, padding: 10 },
  revokeTxt: { fontFamily: FONTS.bodySemiBold, fontSize: 13 },
});
