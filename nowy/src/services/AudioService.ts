
export const AudioService = {
  playSuccess() {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play blocked by browser policy', e));
    } catch (e) {
      console.error('Error playing success sound', e);
    }
  }
};
