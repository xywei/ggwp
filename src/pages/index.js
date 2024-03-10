import React, { useState, useEffect, useCallback, useRef } from 'react';

const MainPage = () => {
  const [isPopUpVisible, setIsPopUpVisible] = useState(true);
  const [showControls, setShowControls] = useState(false);

  const [lightOn, setLightOn] = useState(false);
  const [targetInterval, setTargetInterval] = useState(25);
  const [maxVolume, setMaxVolume] = useState(0.33);
  const [maxInvert, setMaxInvert] = useState(33);

  // xxxIntervalCount is the number of intervals sent for rendering, actual
  // FPS also depends on display's refresh rate and other factors. It is
  // an okay estimate of the audio frequency though.
  const audioIntervalCount = useRef(0);
  const videoIntervalCount = useRef(0);

  useEffect(() => {
    function estimateRefreshRate(callback) {
      const frameTimes = [];
      let lastTime = performance.now();

      function frame(time) {
        frameTimes.push(time - lastTime);
        lastTime = time;

        if (frameTimes.length > 30) {
          const averageFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
          const fps = 1000 / averageFrameTime;
          callback(fps);
        } else {
          requestAnimationFrame(frame);
        }
      }
      requestAnimationFrame(frame);
    }
    estimateRefreshRate((refreshRate) => {
      console.log("Estimating hardware FPS based on the timing of frame updates in the web browser's rendering engine.")
      console.log(`Measured refresh rate: ${refreshRate.toFixed(2)} FPS`);
      const supportedFPSTargets = [60, 120, 144, 240];
      const estimatedFPS = supportedFPSTargets.reduce((prev, curr) => (
        Math.abs(curr - refreshRate) < Math.abs(prev - refreshRate) ? curr : prev
      ));
      console.log(`Inferred display FPS: ${estimatedFPS}`);

      // Visual flicker rate is adjusted to align with screen refresh rate
      // to a subharmonic/harmonic of 40Hz or a base frequency within the
      // range of 37.75 +/- 1.84 * 2 Hz (i.e. 34.07Hz - 41.43Hz)
      let target = 1000 / 40
      if (estimatedFPS === 60) { // targets 20Hz, a subharmonic of 40Hz
        target = 1000 / 20
      } else if (estimatedFPS === 144) { // targets 36Hz
        target = 1000 / 36
      }
      setTargetInterval(target);
      console.log(`Target video interval set to ${target}ms`)
    });
  }, []);

  useEffect(() => {
    if (!isPopUpVisible) {
      const AudioContext = window.AudioContext || window.AudioContext;
      const audioContext = new AudioContext();

      // Audio is always 40Hz
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequency in hertz
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0, audioContext.currentTime); // start with gain 0 (silent)

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();

      // Sound
      const audioIntervalId = setInterval(() => {
        audioIntervalCount.current++;
        gainNode.gain.setValueAtTime(maxVolume, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.001);
      }, 25);

      // Light
      const videoIntervalId = setInterval(() => {
        videoIntervalCount.current++;
        setLightOn(true);
        setTimeout(() => {
          setLightOn(false);
        }, 0.5 * targetInterval);
      }, targetInterval);

      // Set up an interval to calculate and update intervals per second every second
      const statsIntervalId = setInterval(() => {
        console.log(`Current (audio, video) intervals per second: ${audioIntervalCount.current}, ${videoIntervalCount.current}`);
        audioIntervalCount.current = 0;
        videoIntervalCount.current = 0;
      }, 1000);

      return () => {
        clearInterval(audioIntervalId);
        clearInterval(videoIntervalId);
        clearInterval(statsIntervalId);
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
        audioContext.close();
      };
    }
  }, [isPopUpVisible, maxVolume, targetInterval]);

  const handleVolumeChange = (event) => {
    setMaxVolume(parseFloat(event.target.value));
  };

  const handleInvertChange = (event) => {
    setMaxInvert(parseFloat(event.target.value));
  };

  const handlePauseToggle = useCallback(() => {
    setIsPopUpVisible(prevVisible => !prevVisible);
  }, []);

  const handleClickAnywhere = useCallback(() => {
    setIsPopUpVisible(true);
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleClickAnywhere);
    return () => {
      document.removeEventListener('click', handleClickAnywhere);
    };
  }, [handleClickAnywhere]);

  const toggleFullscreen = () => {
    if (document.fullscreenEnabled) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    }
  };

  const toggleControlsVisibility = () => {
    setShowControls(prevShowControls => !prevShowControls);
  };

  // use space bar to pause/start
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handlePauseToggle();
      } else if (event.code === 'KeyF') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.code === 'KeyB') {
        event.preventDefault();
        handleBackgroundToggle();
      } else if (event.code === 'KeyM') {
        event.preventDefault();
        toggleControlsVisibility();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        setMaxVolume(prevVolume => Math.min(prevVolume + 0.1, 1));
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        setMaxVolume(prevVolume => Math.max(prevVolume - 0.1, 0));
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        setMaxInvert(preInvert => Math.max(preInvert - 10, 0));
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        setMaxInvert(preInvert => Math.min(preInvert + 10, 100));
      }
    };
    document.body.addEventListener('keydown', handleKeyDown);
    return () => { document.body.removeEventListener('keydown', handleKeyDown); };
  }, [handlePauseToggle]);

  const styles = {
    popUp: {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      padding: '20px',
      zIndex: 1,
      borderRadius: '10px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      color: 'black',
    },
  };

  return (
    <div>
    <div id="full-page-overlay" className="fixed top-0 left-0 w-full h-full z-0"
    style={{
        filter: `brightness(${lightOn? '100%' : '100%'}) invert(${lightOn ? '0%' : `${maxInvert}%`})`,
        backgroundColor: 'white',
    }}/>

    {isPopUpVisible && (
      <div className="fixed" style={styles.popUp}>
      <h1 className="text-xl"><span className="text-7xl font-black">GGWP</span> a <b>G</b>amma-<b>G</b>enerating <b>W</b>eb <b>P</b>lace</h1>
      <h2 className="text-xl py-2 font-bold">Quick start</h2>
      Click the play button below to start. While playing, click anywhere to stop.
      <div className="flex justify-center items-center py-1">
      <button type="button" className="text-gray-100 rounded px-1 py-1" onClick={(event) => { event.stopPropagation(); handlePauseToggle(); }}>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="#000" version="1.1" viewBox="-51.2 -51.2 614.4 614.4" xmlSpace="preserve">
      <rect width="614.4" height="614.4" x="-51.2" y="-51.2" fill="lightgray" strokeWidth="0" rx="307.2"/>
      <g><path d="M256 0C114.608 0 0 114.608 0 256s114.608 256 256 256 256-114.608 256-256S397.392 0 256 0zm0 496C123.664 496 16 388.336 16 256S123.664 16 256 16s240 107.664 240 240-107.664 240-240 240z"/><path d="M189.776 141.328L189.776 370.992 388.672 256.16z"/></g></svg>
      </button>
      </div>
      <h2 className="text-xl py-2 font-bold">Keyboard shortcuts</h2>
      <ul>
      <li>Space - Play/Pause</li>
      <li>Up/Down - Audio amplitude +/-</li>
      <li>Right/Left - Visual amplitude +/-</li>
      <li>M - Toggle menu visibility</li>
      <li>F - Toggle fullscreen</li>
      </ul>
      <h2 className="text-xl py-2 font-bold">Note</h2>
      <ul>
      <li>This app generates audio oscillations at 40Hz, with visual oscillations adapted to refresh rate.</li>
      </ul>
      <div className="flex justify-center py-2">
      <p> <a className="underline" href="https://shuhari.me/posts/ggwp">Learn More</a> | <a className="underline" href="https://raw.githubusercontent.com/xywei/ggwp/main/DISCLAIMER.md">Disclaimer</a> | <a className="underline" href="https://raw.githubusercontent.com/xywei/ggwp/main/LICENSE.md">License</a></p>
      </div>
      </div>
    )}

    {showControls && (
      <div className="absolute bottom-12 right-2 bg-gray-200 text-black z-50 px-4 py-2 rounded">
      <div>Volume:&nbsp;&nbsp; <input type="range" min="0" max="1" step="0.01" value={maxVolume} onChange={handleVolumeChange} /></div>
      <div>Contrast: <input type="range" min="0" max="100" step="1" value={maxInvert} onChange={handleInvertChange} /></div>

      <div className="flex justify-end px-1 pt-5">
      <button type="button" onClick={(event) => { event.stopPropagation(); toggleFullscreen(); }}>
      <svg className="h-5 w-5 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <g> <g fill="none" fillRule="evenodd" stroke="none" strokeWidth="1"> <g fill="gray" transform="translate(-300 -4199)">
      <g transform="translate(56 160)"> <path d="M262.445 4039H256v2h6v6h2v-8h-1.555zm-.445 18h-6v2h8v-8h-2v6zm-16-6h-2v8h8v-2h-6v-6zm0-4h-2v-8h8v2h-6v6z"/> </g>
      </g> </g> </g> </svg>
      </button>
      </div>

      </div>
    )}
    <div className="fixed bottom-0 right-0 z-10 text-white px-2 py-2 rounded">
    <button type="button"
    className="relative float-right z-10 bg-gray-500 px-1 py-1 rounded"
    onClick={(event) => { event.stopPropagation(); toggleControlsVisibility(); }}>
    <svg fill="lightgray" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6"><path d="M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM115.4 518.9L271.7 642c5.8 4.6 14.4.5 14.4-6.9V388.9c0-7.4-8.5-11.5-14.4-6.9L115.4 505.1a8.74 8.74 0 0 0 0 13.8z"/></svg> 
    </button>
    </div>
    </div>
  );
};

export default MainPage;
