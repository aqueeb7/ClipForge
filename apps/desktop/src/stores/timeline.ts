import { defineStore } from "pinia";

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  inPoint: number | null;
  outPoint: number | null;
  selectedClipId: string | null;
  isVerticalSimulated: boolean;
  zoomLevel: number;
  isTimelineExpanded: boolean;
}

export const useTimelineStore = defineStore("timeline", {
  state: (): TimelineState => ({
    currentTime: 0,
    isPlaying: false,
    inPoint: null,
    outPoint: null,
    selectedClipId: null,
    isVerticalSimulated: true,
    zoomLevel: 1.0,
    isTimelineExpanded: false
  }),

  getters: {
    hasSelectionRange: (state) =>
      state.inPoint !== null && state.outPoint !== null && state.outPoint > state.inPoint,
    selectionDuration: (state) =>
      state.inPoint !== null && state.outPoint !== null && state.outPoint > state.inPoint
        ? state.outPoint - state.inPoint
        : 0
  },

  actions: {
    setCurrentTime(time: number) {
      this.currentTime = Math.max(0, time);
    },

    play() {
      this.isPlaying = true;
    },

    pause() {
      this.isPlaying = false;
    },

    togglePlay() {
      this.isPlaying = !this.isPlaying;
    },

    setInPoint(time?: number) {
      const val = time !== undefined ? time : this.currentTime;
      this.inPoint = Math.round(val * 100) / 100;
      if (this.outPoint !== null && this.outPoint <= this.inPoint) {
        this.outPoint = null;
      }
    },

    setOutPoint(time?: number) {
      const val = time !== undefined ? time : this.currentTime;
      const rounded = Math.round(val * 100) / 100;
      if (this.inPoint !== null && rounded > this.inPoint) {
        this.outPoint = rounded;
      } else {
        this.outPoint = rounded;
      }
    },

    clearMarkers() {
      this.inPoint = null;
      this.outPoint = null;
    },

    selectClip(id: string | null) {
      this.selectedClipId = id;
    },

    toggleVerticalSimulated() {
      this.isVerticalSimulated = !this.isVerticalSimulated;
    },

    setZoomLevel(level: number) {
      this.zoomLevel = Math.max(1.0, Math.min(25.0, Math.round(level * 10) / 10));
    },

    zoomIn() {
      this.setZoomLevel(this.zoomLevel * 1.4);
    },

    zoomOut() {
      this.setZoomLevel(this.zoomLevel / 1.4);
    },

    resetZoom() {
      this.zoomLevel = 1.0;
    },

    toggleTimelineExpanded() {
      this.isTimelineExpanded = !this.isTimelineExpanded;
    }
  }
});
