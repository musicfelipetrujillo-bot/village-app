// ManualVideo — thin route wrapper around the shared <ClipPlayer>.
//
// Builds the clip list from the route params and hands it to ClipPlayer
// (the player itself lives in components/manual/ClipPlayer so every video
// surface shares one treatment). Three param shapes are supported:
//   • { clips: ClipRef[] }                  — cross-chapter playlist (this-week, saved)
//   • { playlist: string[], audience, category } — same-chapter row (chapter screen)
//   • { videoId, audience, category }        — a single clip
import React from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import ClipPlayer, { type ClipRef } from '@/components/manual/ClipPlayer';
import type { ManualAudience } from '@/api/manual';

type ParamList = {
  ManualVideo: {
    audience: ManualAudience;
    category: string;
    videoId: string;
    playlist?: string[];          // same-chapter ordered ids
    clips?: ClipRef[];            // cross-chapter ordered refs
    playlistIndex?: number;
  };
};

export default function ManualVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualVideo'>>();
  const { audience, category, videoId, playlist, clips, playlistIndex } = route.params;

  const list: ClipRef[] = clips?.length
    ? clips
    : playlist?.length
      ? playlist.map((id) => ({ id, audience, category }))
      : [{ id: videoId, audience, category }];

  const startIndex = playlistIndex ?? Math.max(0, list.findIndex((c) => c.id === videoId));

  return <ClipPlayer clips={list} startIndex={startIndex} onClose={() => navigation.goBack()} />;
}
