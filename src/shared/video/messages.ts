// The Phase 7 refusal reasons and sentences (spec/phases/phase-07.md "Design additions";
// spec/data-rules.md "Changing a variant's format"). The one copy: commands, jobs and screens
// import them from here. No sentence holds a path, a key or a value the user typed.
import { AppError } from '@/shared/schemas/result'

// details.reason of a RULE_VIOLATION whose sentence is fixed.
export const VIDEO_REASONS = [
  'video_not_built',
  'clip_overlap',
  'clip_trim_out_of_range',
  'clip_asset_not_usable',
  'clip_video_unreadable',
  'sound_asset_not_audio',
  'video_needs_video_post',
  'background_empty',
  'video_post_exists',
  'image_post_exists',
] as const
export type VideoReason = (typeof VIDEO_REASONS)[number]

export const VIDEO_REASON_MESSAGES: Record<VideoReason, string> = {
  video_not_built: 'This part of video editing is not built yet.',
  clip_overlap: 'Clips on the track cannot overlap.',
  clip_trim_out_of_range: "That trim reaches past the end of the clip's file.",
  clip_asset_not_usable: 'Use a picture, or an MP4 or MOV video, from the assets library.',
  clip_video_unreadable: "The app could not read this video's length.",
  sound_asset_not_audio: 'Choose an audio file (MP3, WAV, M4A or AAC) from the assets library.',
  video_needs_video_post: 'Change this post to video before making a clip for it.',
  background_empty: 'This post has no background picture yet. Add one, or start from a prompt.',
  // The grid test of variant.setFormat, one sentence per direction of the change.
  video_post_exists: 'This direction already has a video post at this size and language.',
  image_post_exists: 'This direction already has an image post at this size and language.',
}

// The RULE_VIOLATION for a fixed reason, with its sentence.
export function videoRefusal(reason: VideoReason): AppError {
  return new AppError('RULE_VIOLATION', VIDEO_REASON_MESSAGES[reason], { reason })
}

// The two reasons whose sentence names the provider (its display name, never a key).
export const videoStartNotOffered = (provider: string): string =>
  `${provider} cannot start a video this way.`

export const videoLengthNotOffered = (provider: string, min: number, max: number): string =>
  `${provider} makes clips of ${min} to ${max} seconds.`

export function videoStartRefusal(provider: string): AppError {
  return new AppError('RULE_VIOLATION', videoStartNotOffered(provider), {
    reason: 'video_start_not_offered',
  })
}

export function videoLengthRefusal(provider: string, min: number, max: number): AppError {
  return new AppError('RULE_VIOLATION', videoLengthNotOffered(provider, min, max), {
    reason: 'video_length_not_offered',
  })
}
