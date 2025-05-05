document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const scanButton = document.getElementById('scan-button');
    const downloadButton = document.getElementById('download-button');
    const statusElement = document.getElementById('status');
    const croppedCanvas = document.getElementById('cropped-canvas');
    const barcodeCanvas = document.getElementById('barcode-canvas');
    const interactiveElement = document.querySelector('#interactive');
    
    // Calculate one-third of screen width
    const screenWidth = window.innerWidth;
    const desiredWidth = Math.floor(screenWidth / 3);
    
    // Set the width of the interactive element (video container)
    interactiveElement.style.width = `${desiredWidth}px`;
    interactiveElement.style.height = '100vh'; // Full viewport height
    
    // Variables
    const croppedCtx = croppedCanvas.getContext('2d');
    const barcodeCtx = barcodeCanvas.getContext('2d');
    let lastDetectedBarcode = null;
    let isScanning = false;
    let continuousScanEnabled = false;
    
    // QuaggaJS configuration - update constraints to match new aspect ratio
    const quaggaConfig = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: interactiveElement,
            constraints: {
                width: desiredWidth,  // Use calculated width
                height: window.innerHeight,  // Full height
                aspectRatio: { ideal: (desiredWidth/window.innerHeight) }, // New aspect ratio
                facingMode: "environment"
            }
        },
        // ... rest of your Quagga config remains the same ...
