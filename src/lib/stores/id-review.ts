import { writable } from 'svelte/store';

// Only successful uploads in this session count as a new photo, never an old rejected photo.
export const newIdPhotoUploaded = writable(false);
