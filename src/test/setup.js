import '@testing-library/jest-dom';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function() {};

// Mock MediaDevices and SpeechRecognition
if (!navigator.mediaDevices) {
  navigator.mediaDevices = {};
}
navigator.mediaDevices.getUserMedia = () => Promise.resolve({
  getTracks: () => []
});

window.SpeechRecognition = window.SpeechRecognition || function() {
  return {
    start: function() {},
    stop: function() {},
    addEventListener: function() {}
  };
};
