document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const scanButton = document.getElementById('scan-button');
    const downloadButton = document.getElementById('download-button');
    const statusElement = document.getElementById('status');
    const croppedCanvas = document.getElementById('cropped-canvas');
    const barcodeCanvas = document.getElementById('barcode-canvas');
    
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
            target: document.querySelector('#interactive'),
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
    
    // Start the barcode scanner
    startButton.addEventListener('click', () => {
        if (isScanning) return;
        
        Quagga.init(quaggaConfig, (err) => {
            if (err) {
                console.error("Error starting Quagga:", err);
                statusElement.textContent = `Error starting camera: ${err}`;
                return;
            }
            
            // Start Quagga scanner
            Quagga.start();
            isScanning = true;
            
            // Update UI
            startButton.disabled = true;
            stopButton.disabled = false;
            scanButton.disabled = false;
            statusElement.textContent = "Camera active. Point at a barcode or click 'Scan Barcode'.";
            
            // Set up processing event for drawing the location
            Quagga.onProcessed(handleProcessing);
            
            // Set up continuous detection by default
            Quagga.onDetected(handleBarcodeDetection);
        });
    });
    
    // Stop the barcode scanner
    stopButton.addEventListener('click', () => {
        if (!isScanning) return;
        
        Quagga.stop();
        isScanning = false;
        
        // Update UI
        startButton.disabled = false;
        stopButton.disabled = true;
        scanButton.disabled = true;
        statusElement.textContent = "Scanner stopped. Click 'Start Camera' to scan again.";
    });
    
    // Scan button for manual barcode scanning
    scanButton.addEventListener('click', () => {
        if (!isScanning) {
            statusElement.textContent = "Camera not active. Please start the camera first.";
            return;
        }
        
        // Update status
        statusElement.textContent = "Manually scanning for barcode...";
        
        // Take a snapshot of the current video frame
        const videoElement = document.querySelector('#interactive video');
        if (!videoElement) {
            statusElement.textContent = "Error: Video element not found.";
            return;
        }
        
        // Create a snapshot of the current video frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.videoWidth || 640;
        tempCanvas.height = videoElement.videoHeight || 480;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Process the snapshot with Quagga
        Quagga.decodeSingle({
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_93_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "codabar_reader",
                    "i2of5_reader"
                ]
            },
            locate: true,
            src: tempCanvas.toDataURL('image/png')
        }, function(result) {
            if (result && result.codeResult) {
                console.log('Manual scan successful:', result.codeResult.code);
                statusElement.textContent = `Barcode found: ${result.codeResult.code}`;
                
                // Store the detected barcode result
                lastDetectedBarcode = result;
                
                // Get the barcode location box
                let box = null;
                
                // Try to get box directly from result
                if (result.box && typeof result.box.x === 'number' && !isNaN(result.box.x)) {
                    box = result.box;
                    console.log('Using result.box:', box);
                } 
                // Try to calculate from locator boxes
                else if (result.locator && result.locator.boxes && result.locator.boxes.length > 0) {
                    box = getBoundingBoxFromLocations(result.locator.boxes);
                    console.log('Using calculated box from locator.boxes:', box);
                }
                // Fallback to default values if no valid box is found
                else {
                    // Create a default box in the center of the canvas
                    const vw = tempCanvas.width;
                    const vh = tempCanvas.height;
                    box = {
                        x: Math.floor(vw * 0.25),  // 25% from left
                        y: Math.floor(vh * 0.25),  // 25% from top
                        width: Math.floor(vw * 0.5),  // 50% of width
                        height: Math.floor(vh * 0.5)  // 50% of height
                    };
                    console.log('Using fallback box:', box);
                }
                
                if (box) {
                    // Use the tempCanvas we already created instead of making a new one
                    cropBarcodeImageFromCanvas(tempCanvas, box, result);
                    
                    // Enable download button
                    downloadButton.disabled = false;
                } else {
                    console.error('Could not determine barcode location');
                    statusElement.textContent = `Barcode detected but location unknown: ${result.codeResult.code}`;
                }
            } else {
                console.log('Manual scan failed to detect barcode');
                statusElement.textContent = "No barcode found. Try again or reposition the barcode.";
            }
        });
    });
    
    // Download the cropped barcode image
    downloadButton.addEventListener('click', () => {
        if (!lastDetectedBarcode) {
            statusElement.textContent = "No barcode has been detected yet.";
            return;
        }
        
        try {
            // Make sure the cropped canvas has content
            if (croppedCanvas.width === 0 || croppedCanvas.height === 0) {
                statusElement.textContent = "Cannot download: invalid image dimensions";
                return;
            }
            
            // Create a download link
            const link = document.createElement('a');
            link.download = `barcode-${lastDetectedBarcode.codeResult.code}.png`;
            
            // Convert canvas to blob and create object URL
            croppedCanvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                link.href = url;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up object URL
                setTimeout(() => URL.revokeObjectURL(url), 100);
            });
            
            // Update status
            statusElement.textContent = 'Barcode image downloaded successfully!';
            console.log('Download initiated for barcode:', lastDetectedBarcode.codeResult.code);
        } catch (error) {
            console.error('Error downloading image:', error);
            statusElement.textContent = `Error downloading image: ${error.message}`;
        }
    });
    
    // Handle barcode detection
    function handleBarcodeDetection(result) {
        if (!result || !result.codeResult) return;
        
        // Store the detected barcode result
        lastDetectedBarcode = result;
        
        // Log the full detection result for debugging
        console.log('Barcode detected:', result.codeResult.code);
        console.log('FULL RESULT:', result);
        console.log('CODE RESULT:', result.codeResult);
        
        if (result.codeResult.location) {
            console.log('LOCATION POINTS:', result.codeResult.location);
        }
        
        console.log('Result structure:', {
            hasBox: !!result.box,
            hasLocator: !!result.locator,
            boxesCount: result.locator && result.locator.boxes ? result.locator.boxes.length : 0
        });
        
        // Get the barcode location box
        let box = null;
        
        // Try to get box directly from result
        if (result.box && typeof result.box.x === 'number' && !isNaN(result.box.x)) {
            box = result.box;
            console.log('Using result.box:', box);
        } 
        // Try to calculate from locator boxes
        else if (result.locator && result.locator.boxes && result.locator.boxes.length > 0) {
            box = getBoundingBoxFromLocations(result.locator.boxes);
            console.log('Using calculated box from locator.boxes:', box);
        }
        // Fallback to default values if no valid box is found
        else {
            // Create a default box in the center of the video
            const videoElement = document.querySelector('#interactive video');
            if (videoElement) {
                const vw = videoElement.videoWidth || 640;
                const vh = videoElement.videoHeight || 480;
                box = {
                    x: Math.floor(vw * 0.25),  // 25% from left
                    y: Math.floor(vh * 0.25),  // 25% from top
                    width: Math.floor(vw * 0.5),  // 50% of width
                    height: Math.floor(vh * 0.5)  // 50% of height
                };
                console.log('Using fallback box:', box);
            }
        }
        
        if (box) {
            // Crop the barcode image
            cropBarcodeImage(box, result);
            
            // Enable download button
            downloadButton.disabled = false;
            
            // Update status with barcode info
            statusElement.textContent = `Barcode detected: ${result.codeResult.code}. You can download the image.`;
        } else {
            console.error('Could not determine barcode location');
            statusElement.textContent = `Barcode detected but location unknown: ${result.codeResult.code}`;
        }
    }
    
    // Handle processing event to draw barcode location
    function handleProcessing(result) {
        const drawingCanvas = document.querySelector('#interactive canvas.drawing');
        if (!drawingCanvas) return;
        
        const ctx = drawingCanvas.getContext('2d');
        if (!ctx) return;
        
        // Clear the canvas
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        
        // If we have a result, draw the bounding box
        if (result && result.boxes) {
            // Draw all boxes
            for (let i = 0; i < result.boxes.length; i++) {
                const box = result.boxes[i];
                
                // Ensure we have valid coordinates
                if (box && Array.isArray(box) && box.length >= 4) {
                    // Get coordinates from box points
                    const validPoints = box.filter(point => 
                        Array.isArray(point) && 
                        point.length >= 2 && 
                        typeof point[0] === 'number' && 
                        typeof point[1] === 'number' && 
                        !isNaN(point[0]) && 
                        !isNaN(point[1])
                    );
                    
                    if (validPoints.length >= 4) {
                        // Draw the box
                        ctx.strokeStyle = '#FF0000';
                        ctx.lineWidth = 2;
                        
                        ctx.beginPath();
                        ctx.moveTo(validPoints[0][0], validPoints[0][1]);
                        
                        for (let j = 1; j < validPoints.length; j++) {
                            ctx.lineTo(validPoints[j][0], validPoints[j][1]);
                        }
                        
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
            }
        }
        
        // If we have a result with a codeResult, highlight the final detection
        if (result && result.codeResult && result.codeResult.code) {
            // Draw the final bounding box
            if (result.box) {
                const box = result.box;
                if (typeof box.x === 'number' && !isNaN(box.x) && 
                    typeof box.y === 'number' && !isNaN(box.y) && 
                    typeof box.width === 'number' && !isNaN(box.width) && 
                    typeof box.height === 'number' && !isNaN(box.height)) {
                    
                    ctx.strokeStyle = '#00FF00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);
                    
                    // Add text with the barcode value
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(box.x, box.y + box.height, box.width, 20);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '12px Arial';
                    ctx.fillText(result.codeResult.code, box.x + 5, box.y + box.height + 15);
                }
            }
        }
    }
    
    // Get a bounding box from location boxes
    function getBoundingBoxFromLocations(boxes) {
        if (!boxes || !Array.isArray(boxes) || boxes.length === 0) {
            console.error('Invalid boxes array:', boxes);
            return null;
        }
        
        // Initialize with extreme values
        let minX = Number.MAX_VALUE;
        let minY = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;
        let maxY = Number.MIN_VALUE;
        
        // Track if we found at least one valid point
        let foundValidPoint = false;
        
        // Find the bounding box that contains all points
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            
            if (Array.isArray(box)) {
                for (let j = 0; j < box.length; j++) {
                    const point = box[j];
                    
                    if (Array.isArray(point) && point.length >= 2) {
                        const x = point[0];
                        const y = point[1];
                        
                        // Skip invalid points
                        if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
                            continue;
                        }
                        
                        // Update bounds
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                        
                        foundValidPoint = true;
                    }
                }
            }
        }
        
        // If we didn't find any valid points, return null
        if (!foundValidPoint) {
            console.error('No valid points found in boxes');
            return null;
        }
        
        // Calculate width and height
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Final validation of dimensions
        if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) {
            console.error('Invalid dimensions calculated:', { minX, minY, maxX, maxY, width, height });
            return null;
        }
        
        return {
            x: minX,
            y: minY,
            width: width,
            height: height
        };
    }
    
    // Crop the barcode image and display it
    function cropBarcodeImage(box, result) {
        try {
            // Skip the box parameter and use the actual barcode location directly
            console.log('Original result object:', result);
            
            // Get the video dimensions and source
            const videoElement = document.querySelector('#interactive video');
            if (!videoElement) {
                console.error('Video element not found');
                return;
            }
            
            // Get video dimensions with fallbacks
            const videoWidth = videoElement.videoWidth || 640;
            const videoHeight = videoElement.videoHeight || 480;
            
            // Create a snapshot of the current video frame
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = videoWidth;
            tempCanvas.height = videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // Get the exact barcode location if available
            let barcodeBox = null;
            
            // The most accurate location is in codeResult.location
            if (result.codeResult && result.codeResult.location) {
                const loc = result.codeResult.location;
                
                // Check if we have all corner points
                if (loc.topLeft && loc.topRight && loc.bottomLeft && loc.bottomRight) {
                    console.log('Using exact barcode corners from codeResult.location', loc);
                    
                    // Find the bounding box from the corner points
                    const minX = Math.min(loc.topLeft.x, loc.topRight.x, loc.bottomLeft.x, loc.bottomRight.x);
                    const minY = Math.min(loc.topLeft.y, loc.topRight.y, loc.bottomLeft.y, loc.bottomRight.y);
                    const maxX = Math.max(loc.topLeft.x, loc.topRight.x, loc.bottomLeft.x, loc.bottomRight.x);
                    const maxY = Math.max(loc.topLeft.y, loc.topRight.y, loc.bottomLeft.y, loc.bottomRight.y);
                    
                    // This is the precise barcode location
                    barcodeBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                }
            }
            
            // If we couldn't get the location from codeResult, try the provided box
            if (!barcodeBox && box && typeof box.x === 'number' && !isNaN(box.x)) {
                barcodeBox = box;
                console.log('Using provided box as fallback:', barcodeBox);
            }
            
            // If we still don't have a valid box, try using locator boxes
            if (!barcodeBox && result.locator && result.locator.boxes && result.locator.boxes.length > 0) {
                console.log('Trying to use locator boxes as last resort');
                // Extract valid points from boxes
                const points = [];
                result.locator.boxes.forEach(boxPoints => {
                    if (Array.isArray(boxPoints)) {
                        boxPoints.forEach(point => {
                            if (Array.isArray(point) && point.length >= 2 && 
                                typeof point[0] === 'number' && !isNaN(point[0]) && 
                                typeof point[1] === 'number' && !isNaN(point[1])) {
                                points.push({x: point[0], y: point[1]});
                            }
                        });
                    }
                });
                
                // If we have enough points, calculate the bounding box
                if (points.length >= 4) {
                    const minX = Math.min(...points.map(p => p.x));
                    const minY = Math.min(...points.map(p => p.y));
                    const maxX = Math.max(...points.map(p => p.x));
                    const maxY = Math.max(...points.map(p => p.y));
                    
                    barcodeBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                }
            }
            
            // If we still don't have a valid box, create a default centered box
            if (!barcodeBox) {
                console.error('Could not determine barcode location, using default centered box');
                barcodeBox = {
                    x: Math.floor(videoWidth * 0.25),
                    y: Math.floor(videoHeight * 0.4),
                    width: Math.floor(videoWidth * 0.5),
                    height: Math.floor(videoHeight * 0.2) // Smaller height for typical barcode proportion
                };
            }
            
            console.log('Final barcode box for cropping:', barcodeBox);
            
            // Add minimal padding (1-2 pixels) to ensure we capture the full barcode
            const padding = 2;
            const x = Math.max(0, Math.floor(barcodeBox.x - padding));
            const y = Math.max(0, Math.floor(barcodeBox.y - padding));
            const width = Math.min(tempCanvas.width - x, Math.floor(barcodeBox.width + (2 * padding)));
            const height = Math.min(tempCanvas.height - y, Math.floor(barcodeBox.height + (2 * padding)));
            
            console.log('Crop dimensions:', { x, y, width, height });
            
            // Ensure dimensions are valid
            if (width <= 0 || height <= 0) {
                console.error('Invalid crop dimensions:', { x, y, width, height });
                return;
            }
            
            // Set cropped canvas size
            croppedCanvas.width = width;
            croppedCanvas.height = height;
            
            // Draw the cropped portion to the visible canvas
            croppedCtx.drawImage(
                tempCanvas,
                x, y, width, height,  // Source rectangle
                0, 0, width, height   // Destination rectangle
            );
            
            // Draw a thin border around the cropped image
            croppedCtx.strokeStyle = "#FF0000";
            croppedCtx.lineWidth = 1;
            croppedCtx.strokeRect(0, 0, width, height);
            
            // Add barcode text in a small bar at the bottom
            const textHeight = Math.min(16, Math.floor(height * 0.2)); // Scale text area with image height
            croppedCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
            croppedCtx.fillRect(0, height - textHeight, width, textHeight);
            croppedCtx.fillStyle = "#FFFFFF";
            croppedCtx.font = `${Math.max(8, Math.min(10, Math.floor(textHeight * 0.7)))}px Arial`;
            croppedCtx.fillText(result.codeResult.code, 3, height - (textHeight * 0.3));
            
            console.log('Barcode cropped successfully');
        } catch (error) {
            console.error('Error cropping barcode image:', error);
            statusElement.textContent = `Error cropping barcode: ${error.message}`;
        }
    }
    
    // Crop the barcode image from an existing canvas
    function cropBarcodeImageFromCanvas(canvas, box, result) {
        try {
            // Skip the box parameter and use the actual barcode location directly
            console.log('Manual scan result object:', result);
            
            // Get the exact barcode location if available
            let barcodeBox = null;
            
            // The most accurate location is in codeResult.location
            if (result.codeResult && result.codeResult.location) {
                const loc = result.codeResult.location;
                
                // Check if we have all corner points
                if (loc.topLeft && loc.topRight && loc.bottomLeft && loc.bottomRight) {
                    console.log('Using exact barcode corners from codeResult.location', loc);
                    
                    // Find the bounding box from the corner points
                    const minX = Math.min(loc.topLeft.x, loc.topRight.x, loc.bottomLeft.x, loc.bottomRight.x);
                    const minY = Math.min(loc.topLeft.y, loc.topRight.y, loc.bottomLeft.y, loc.bottomRight.y);
                    const maxX = Math.max(loc.topLeft.x, loc.topRight.x, loc.bottomLeft.x, loc.bottomRight.x);
                    const maxY = Math.max(loc.topLeft.y, loc.topRight.y, loc.bottomLeft.y, loc.bottomRight.y);
                    
                    // This is the precise barcode location
                    barcodeBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                }
            }
            
            // If we couldn't get the location from codeResult, try the provided box
            if (!barcodeBox && box && typeof box.x === 'number' && !isNaN(box.x)) {
                barcodeBox = box;
                console.log('Using provided box as fallback:', barcodeBox);
            }
            
            // If we still don't have a valid box, try using locator boxes
            if (!barcodeBox && result.locator && result.locator.boxes && result.locator.boxes.length > 0) {
                console.log('Trying to use locator boxes as last resort');
                // Extract valid points from boxes
                const points = [];
                result.locator.boxes.forEach(boxPoints => {
                    if (Array.isArray(boxPoints)) {
                        boxPoints.forEach(point => {
                            if (Array.isArray(point) && point.length >= 2 && 
                                typeof point[0] === 'number' && !isNaN(point[0]) && 
                                typeof point[1] === 'number' && !isNaN(point[1])) {
                                points.push({x: point[0], y: point[1]});
                            }
                        });
                    }
                });
                
                // If we have enough points, calculate the bounding box
                if (points.length >= 4) {
                    const minX = Math.min(...points.map(p => p.x));
                    const minY = Math.min(...points.map(p => p.y));
                    const maxX = Math.max(...points.map(p => p.x));
                    const maxY = Math.max(...points.map(p => p.y));
                    
                    barcodeBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                }
            }
            
            // If we still don't have a valid box, create a default centered box
            if (!barcodeBox) {
                console.error('Could not determine barcode location, using default centered box');
                barcodeBox = {
                    x: Math.floor(canvas.width * 0.25),
                    y: Math.floor(canvas.height * 0.4),
                    width: Math.floor(canvas.width * 0.5),
                    height: Math.floor(canvas.height * 0.2) // Smaller height for typical barcode proportion
                };
            }
            
            console.log('Final barcode box for cropping:', barcodeBox);
            
            // Add minimal padding (1-2 pixels) to ensure we capture the full barcode
            const padding = 2;
            const x = Math.max(0, Math.floor(barcodeBox.x - padding));
            const y = Math.max(0, Math.floor(barcodeBox.y - padding));
            const width = Math.min(canvas.width - x, Math.floor(barcodeBox.width + (2 * padding)));
            const height = Math.min(canvas.height - y, Math.floor(barcodeBox.height + (2 * padding)));
            
            console.log('Crop dimensions:', { x, y, width, height });
            
            // Ensure dimensions are valid
            if (width <= 0 || height <= 0) {
                console.error('Invalid crop dimensions:', { x, y, width, height });
                return;
            }
            
            // Set cropped canvas size
            croppedCanvas.width = width;
            croppedCanvas.height = height;
            
            // Draw the cropped portion to the visible canvas
            croppedCtx.drawImage(
                canvas,
                x, y, width, height,  // Source rectangle
                0, 0, width, height   // Destination rectangle
            );
            
            // Draw a thin border around the cropped image
            croppedCtx.strokeStyle = "#FF0000";
            croppedCtx.lineWidth = 1;
            croppedCtx.strokeRect(0, 0, width, height);
            
            // Add barcode text in a small bar at the bottom
            const textHeight = Math.min(16, Math.floor(height * 0.2)); // Scale text area with image height
            croppedCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
            croppedCtx.fillRect(0, height - textHeight, width, textHeight);
            croppedCtx.fillStyle = "#FFFFFF";
            croppedCtx.font = `${Math.max(8, Math.min(10, Math.floor(textHeight * 0.7)))}px Arial`;
            croppedCtx.fillText(result.codeResult.code, 3, height - (textHeight * 0.3));
            
            console.log('Manual barcode cropped successfully');
        } catch (error) {
            console.error('Error cropping barcode image:', error);
            statusElement.textContent = `Error cropping barcode: ${error.message}`;
        }
    }
    
    // Clean up resources when page is closed
    window.addEventListener('beforeunload', () => {
        if (isScanning) {
            Quagga.stop();
        }
    });
});
