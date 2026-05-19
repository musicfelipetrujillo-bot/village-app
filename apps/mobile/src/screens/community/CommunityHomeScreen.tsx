// V3 C1 — CommunityHomeScreen
// Room discovery. Stage-matched rooms are highlighted at the top via RPC
// list_rooms_for_discovery. Tapping a room goes to RoomChat (built in C2) —
// for C1 we join immediately (if not yet a member) and stub-navigate.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@utils/constants';
import { useAuthStore } from '@store/auth';
import {
  listRoomsForDiscovery, joinRoom, leaveRoom,
  generateIcebreaker,
  type RoomDiscoveryRow,
} from '@api/community';
import { useAnalytics } from '@hooks/useAnalytics';
import type { CommunityStackParamList } from '@/navigation/CommunityNavigator';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityHome'>;

const ROOM_COLOR_ACCENT: Record<string, string> = {
  rust:  COLORS.coco,
  olive: '#5C6B3A',
  brown: '#4A2E1A',
  cream: '#C4A35A',
};

const ROOM_TYPE_LABEL: Record<string, string> = {
  stage_local: 'Local · By stage',
  topic:       'Topic',
  support:     'Support',
};

export default function CommunityHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { trackEvent } = useAnalytics();

  const [rooms, setRooms] = useState<RoomDiscoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listRoomsForDiscovery(user?.id ?? null);
      setRooms(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load rooms';
      Alert.alert('Could not load', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleOpenRoom = async (room: RoomDiscoveryRow) => {
    if (!user) {
      Alert.alert('Sign in first', 'Please sign in to join rooms.');
      return;
    }
    setBusyRoomId(room.id);
    try {
      if (!room.is_member) {
        await joinRoom(room.id);
        trackEvent('community_room_joined', { room_id: room.id, room_slug: room.slug });
        // C5: fire-and-forget icebreaker generation so RoomChat can offer
        // a prefilled opener on first load. Failure is silent — the user
        // just won't see a suggestion.
        void generateIcebreaker(room.id).catch(() => {});
      }
      trackEvent('community_room_opened', { room_id: room.id, room_slug: room.slug });
      navigation.navigate('RoomChat', { roomId: room.id, roomSlug: room.slug });
      // Optimistically update membership
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id ? { ...r, is_member: true, member_count: r.member_count + (r.is_member ? 0 : 1) } : r
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open room';
      Alert.alert('Could not open', msg);
    } finally {
      setBusyRoomId(null);
    }
  };

  const handleLeaveRoom = async (room: RoomDiscoveryRow) => {
    Alert.alert(
      'Leave room?',
      `You can rejoin ${room.name} anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setBusyRoomId(room.id);
            try {
              await leaveRoom(room.id);
              trackEvent('community_room_left', { room_id: room.id, room_slug: room.slug });
              setRooms((prev) =>
                prev.map((r) =>
                  r.id === room.id ? { ...r, is_member: false, member_count: Math.max(0, r.member_count - 1) } : r
                )
              );
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Could not leave room';
              Alert.alert('Could not leave', msg);
            } finally {
              setBusyRoomId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator color="#C07840" size="large" />
      </SafeAreaView>
    );
  }

  const matchedRooms = rooms.filter((r) => r.stage_match_score > 0);
  const otherRooms = rooms.filter((r) => r.stage_match_score === 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coco} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>Moderated rooms for real conversations.</Text>
        </View>

        {matchedRooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>For your stage</Text>
            {matchedRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                busy={busyRoomId === room.id}
                onOpen={() => handleOpenRoom(room)}
                onLeave={() => handleLeaveRoom(room)}
                highlighted
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All rooms</Text>
          {otherRooms.length === 0 && matchedRooms.length === 0 ? (
            <Text style={styles.emptyText}>No rooms available yet.</Text>
          ) : (
            otherRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                busy={busyRoomId === room.id}
                onOpen={() => handleOpenRoom(room)}
                onLeave={() => handleLeaveRoom(room)}
              />
            ))
          )}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Rooms are moderated. Crisis? Tap <Text style={styles.footerBold}>I need help now</Text> at any time, or call{' '}
            <Text style={styles.footerBold}>988</Text> (24/7 Suicide & Crisis Lifeline).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// RoomCard
// ---------------------------------------------------------------------------

interface RoomCardProps {
  room: RoomDiscoveryRow;
  busy: boolean;
  onOpen: () => void;
  onLeave: () => void;
  highlighted?: boolean;
}

function RoomCard({ room, busy, onOpen, onLeave, highlighted }: RoomCardProps) {
  const accent = ROOM_COLOR_ACCENT[room.color_theme] ?? COLORS.coco;
  return (
    <View style={[styles.roomCard, highlighted && { borderColor: accent, borderWidth: 1.5 }]}>
      <View style={styles.roomCardHead}>
        <Text style={styles.roomEmoji}>{room.emoji}</Text>
        <View style={styles.roomCardHeadText}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          <Text style={styles.roomMeta} numberOfLines={1}>
            {ROOM_TYPE_LABEL[room.room_type]}
            {room.city ? ` · ${room.city}` : ''}
            {' · '}
            {room.member_count} {room.member_count === 1 ? 'member' : 'members'}
          </Text>
        </View>
        {room.anonymous_mode === 'mandatory' && (
          <View style={[styles.badge, { backgroundColor: '#F5E9D8', borderColor: accent }]}>
            <Text style={[styles.badgeText, { color: accent }]}>Anonymous</Text>
          </View>
        )}
      </View>

      <Text style={styles.roomDesc} numberOfLines={2}>{room.description}</Text>

      <View style={styles.roomActions}>
        <TouchableOpacity
          style={[styles.openBtn, { backgroundColor: accent }]}
          onPress={onOpen}
          disabled={busy}
          accessibilityLabel={`Open ${room.name}`}
          accessibilityRole="button"
        >
          {busy
            ? <ActivityIndicator color="#FDFBF6" />
            : <Text style={styles.openBtnText}>{room.is_member ? 'Open' : 'Join & open'}</Text>
          }
        </TouchableOpacity>
        {room.is_member && (
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={onLeave}
            disabled={busy}
            accessibilityLabel={`Leave ${room.name}`}
            accessibilityRole="button"
          >
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: COLORS.cream },
  loadingWrap:  { flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
  scroll:       { paddingBottom: 40 },

  header:       { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  headerTitle:  { fontSize: 32, color: COLORS.bark, fontFamily: FONTS.bodySemiBold },
  headerSubtitle: { fontSize: 14, color: COLORS.barkSoft, marginTop: 4 },

  section:      { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginTop: 12, paddingHorizontal: 4,
  },
  emptyText:    { color: COLORS.textLight, fontSize: 14, paddingHorizontal: 4, paddingVertical: 10 },

  roomCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
  },
  roomCardHead: { flexDirection: 'row', alignItems: 'center' },
  roomEmoji:    { fontSize: 28, marginRight: 10 },
  roomCardHeadText: { flex: 1 },
  roomName:     { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  roomMeta:     { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  roomDesc:     { fontSize: 14, color: COLORS.barkSoft, marginTop: 8, lineHeight: 20 },

  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  badgeText:    { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.4 },

  roomActions:  { flexDirection: 'row', marginTop: 12, gap: 8 },
  openBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  openBtnText:  { color: COLORS.paper, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
  leaveBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.18)',
  },
  leaveBtnText: { color: COLORS.barkSoft, fontSize: 14, fontFamily: FONTS.bodyMedium },

  footerNote:     { paddingHorizontal: 20, paddingTop: 20 },
  footerNoteText: { fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
  footerBold:     { fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
});
