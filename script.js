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
    
    // Calculate one-third of screen height
    const screenHeight = window.innerHeight;
    const desiredHeight = Math.floor(screenHeight / 3);
    
    // Set the height of the interactive element (video container)
    interactiveElement.style.height = `${desiredHeight}px`;
    
    // Variables
    const croppedCtx = croppedCanvas.getContext('2d');
    const barcodeCtx = barcodeCanvas.getContext('2d');
    let lastDetectedBarcode = null;
    let isScanning = false;
    let continuousScanEnabled = false;
    
    // QuaggaJS configuration
    const quaggaConfig = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: interactiveElement,
            constraints: {
                width: 1280,  // Higher resolution for better detection
                height: 720,
                facingMode: "environment"
            }
        },
        locator: {
            patchSize: "large",  // Use larger patches for more stable detection
            halfSample: false     // Don't half sample for better accuracy
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
            readers: [
                // Limit to the most common barcode types for better performance
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader"
            ],
            multiple: false,      // Only detect one barcode at a time
            tryHarder: true,      // Try harder to detect barcodes
            // Increase stability by requiring more confidence
            debug: {
                drawBoundingBox: true,
                showFrequency: true,
                drawScanline: true,
                showPattern: true
            }
        },
        locate: true,
        frequency: 5,  // Reduce frames per second to analyze for more stability
        tracking: true // Enable tracking for more stable detection
    };
    
    // [Rest of your existing code remains exactly the same...]
    // Start the barcode scanner
    startButton.addEventListener('click', () => {
    // ... all the rest of your existing code ...
