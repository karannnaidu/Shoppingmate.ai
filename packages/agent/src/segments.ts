// Segment playbooks live in @shoppingmate/shared so the dashboard (Settings →
// business type) can show the same detection the assistant uses.
export {
  type Segment,
  SEGMENT_PLAYBOOK,
  SERVICE_SEGMENTS,
  detectSegment,
  segmentBlock,
  segmentVoiceRule,
} from '@shoppingmate/shared';
