// Presentation data
let presentation = {
    slides: [],
    currentIndex: 0,
    isPlaying: false,
    timers: []
};

// DOM elements
const elements = {
    presentationFile: document.getElementById('presentationFile'),
    currentImage: document.getElementById('currentImage'),
    currentVideo: document.getElementById('currentVideo'),
    pointer: document.getElementById('pointer'),
    currentCaption: document.getElementById('currentCaption'),
    currentAudio: document.getElementById('currentAudio'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    errorMessage: document.getElementById('errorMessage'),
    currentSlideNumber: document.getElementById('currentSlideNumber'),
    totalSlides: document.getElementById('totalSlides')
};

// Initialize the player
function init() {
    setupEventListeners();
}

function loadPresentation(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);
            
            // Handle both old format (array) and new format (object)
            if (Array.isArray(loadedData)) {
                presentation.slides = loadedData.map(slide => ({
                    ...slide,
                    mediaType: slide.mediaType || 'image' // Default to image for backward compatibility
                }));
            } else if (loadedData.slides) {
                presentation.slides = loadedData.slides.map(slide => ({
                    ...slide,
                    mediaType: slide.mediaType || 'image'
                }));
            } else {
                throw new Error("Invalid presentation format");
            }
            
            presentation.currentIndex = 0;
            updateUI();
            loadSlide();
            
            // Hide error if previously shown
            showError(false);
        } catch (error) {
            showError("Error loading presentation: " + error.message);
        }
    };
    reader.readAsText(file);
}

function loadSlide() {
    // Clear any existing timers
    clearTimers();
    
    const slide = presentation.slides[presentation.currentIndex];
    
    if (!slide) {
        showError("No slides loaded");
        return;
    }
    
    // Hide all media elements first
    elements.currentImage.style.display = 'none';
    elements.currentVideo.style.display = 'none';
    
    // Load appropriate media based on type
    if (slide.mediaType === 'video') {
        elements.currentVideo.src = slide.media;
        elements.currentVideo.style.display = 'block';
        elements.currentVideo.onerror = () => {
            showError(`Failed to load video: ${slide.media}`);
        };
    } else {
        elements.currentImage.src = slide.media;
        elements.currentImage.style.display = 'block';
        elements.currentImage.onerror = () => {
            showError(`Failed to load image: ${slide.media}`);
        };
    }
    
    // Load audio (only for image slides)
    if (slide.mediaType === 'image') {
        elements.currentAudio.src = slide.audio;
        elements.currentAudio.onerror = () => {
            showError(`Failed to load audio: ${slide.audio}`);
        };
    } else {
        elements.currentAudio.src = '';
    }
    
    // Load caption
    elements.currentCaption.textContent = slide.caption || '';
    
    // Update UI
    updateUI();
    
    // If playing, start the sequence after media loads
    if (presentation.isPlaying) {
        if (slide.mediaType === 'video') {
            elements.currentVideo.onloadeddata = function() {
                startSequence();
            };
        } else {
            elements.currentImage.onload = function() {
                startSequence();
            };
        }
    }
}

function startSequence() {
    const slide = presentation.slides[presentation.currentIndex];
    
    if (slide.mediaType === 'video') {
        // For videos, just play the video
        const videoPromise = elements.currentVideo.play().catch(e => {
            showError("Video playback failed. Please click the play button.");
            console.error("Video playback error:", e);
            presentation.isPlaying = false;
            updateUI();
            return Promise.reject(e);
        });
        
        // Set timer for next slide based on video duration
        videoPromise.then(() => {
            const videoDuration = elements.currentVideo.duration * 1000;
            presentation.timers.push(setTimeout(() => {
                nextSlide();
            }, videoDuration));
        });
    } else {
        // For images, play audio and animate pointer
        const audioPromise = elements.currentAudio.play().catch(e => {
            showError("Audio playback failed. Please click the play button.");
            console.error("Audio playback error:", e);
            presentation.isPlaying = false;
            updateUI();
            return Promise.reject(e);
        });
        
        // Start pointer animation
        animatePointer(slide.pointerPath || []);
        
        audioPromise.then(() => {
            const audioDuration = elements.currentAudio.duration * 1000;
            presentation.timers.push(setTimeout(() => {
                nextSlide();
            }, audioDuration));
        }).catch(() => {
            const pointerDuration = (slide.pointerPath || []).reduce((sum, point) => sum + point.wait + 3000, 0) || 5000;
            presentation.timers.push(setTimeout(() => {
                nextSlide();
            }, pointerDuration));
        });
    }
}

function animatePointer(path) {
    if (!path || path.length === 0) return;
    
    const img = elements.currentImage;
    const container = img.parentElement;
    elements.pointer.style.display = 'block';
    let currentPoint = 0;
    
    function moveToNextPoint() {
        if (currentPoint >= path.length) return;
        
        const point = path[currentPoint];
        const imgRect = img.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate the actual displayed image area
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const containerRatio = containerRect.width / containerRect.height;
        
        let displayedWidth, displayedHeight, offsetX, offsetY;
        
        if (imgRatio > containerRatio) {
            displayedWidth = containerRect.width;
            displayedHeight = containerRect.width / imgRatio;
            offsetX = 0;
            offsetY = (containerRect.height - displayedHeight) / 2;
        } else {
            displayedHeight = containerRect.height;
            displayedWidth = containerRect.height * imgRatio;
            offsetX = (containerRect.width - displayedWidth) / 2;
            offsetY = 0;
        }
        
        // Calculate position accounting for letterboxing
        const xPos = offsetX + (point.x / 100) * displayedWidth;
        const yPos = offsetY + (point.y / 100) * displayedHeight;
        
        // Position pointer relative to container
        elements.pointer.style.left = `${xPos}px`;
        elements.pointer.style.top = `${yPos}px`;
        
        currentPoint++;
        
        if (currentPoint < path.length) {
            presentation.timers.push(setTimeout(moveToNextPoint, path[currentPoint].wait));
        }
    }
    
    // Initialize first position
    const firstPoint = path[0];
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Recalculate displayed area
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerRect.width / containerRect.height;
    
    let displayedWidth, displayedHeight, offsetX, offsetY;
    
    if (imgRatio > containerRatio) {
        displayedWidth = containerRect.width;
        displayedHeight = containerRect.width / imgRatio;
        offsetX = 0;
        offsetY = (containerRect.height - displayedHeight) / 2;
    } else {
        displayedHeight = containerRect.height;
        displayedWidth = containerRect.height * imgRatio;
        offsetX = (containerRect.width - displayedWidth) / 2;
        offsetY = 0;
    }
    
    const xPos = offsetX + (firstPoint.x / 100) * displayedWidth;
    const yPos = offsetY + (firstPoint.y / 100) * displayedHeight;
    
    elements.pointer.style.transition = 'none';
    elements.pointer.style.left = `${xPos}px`;
    elements.pointer.style.top = `${yPos}px`;
    void elements.pointer.offsetWidth; // Force reflow
    elements.pointer.style.transition = 'left 3s ease, top 3s ease';
    
    // Start moving
    presentation.timers.push(setTimeout(moveToNextPoint, firstPoint.wait));
}

function nextSlide() {
    if (presentation.currentIndex < presentation.slides.length - 1) {
        presentation.currentIndex++;
    } else {
        presentation.currentIndex = 0;
    }
    loadSlide();
}

function prevSlide() {
    if (presentation.currentIndex > 0) {
        presentation.currentIndex--;
    } else {
        presentation.currentIndex = presentation.slides.length - 1;
    }
    loadSlide();
}

function togglePlayPause() {
    presentation.isPlaying = !presentation.isPlaying;
    
    if (presentation.isPlaying) {
        startSequence();
    } else {
        const slide = presentation.slides[presentation.currentIndex];
        if (slide.mediaType === 'video') {
            elements.currentVideo.pause();
        } else {
            elements.currentAudio.pause();
        }
        clearTimers();
    }
    
    updateUI();
}

function clearTimers() {
    presentation.timers.forEach(timer => clearTimeout(timer));
    presentation.timers = [];
    elements.pointer.style.display = 'none';
}

function showError(message) {
    if (message === false) {
        elements.errorMessage.style.display = 'none';
        return;
    }
    
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
}

function updateUI() {
    // Update play/pause button
    if (presentation.isPlaying) {
        elements.playPauseBtn.textContent = 'Pause';
        elements.playPauseBtn.classList.add('playing');
    } else {
        elements.playPauseBtn.textContent = 'Play';
        elements.playPauseBtn.classList.remove('playing');
    }
    
    // Update navigation buttons
    elements.prevBtn.disabled = presentation.currentIndex === 0 || presentation.slides.length === 0;
    elements.nextBtn.disabled = presentation.currentIndex === presentation.slides.length - 1 || presentation.slides.length === 0;
    
    // Update slide counter
    elements.currentSlideNumber.textContent = presentation.slides.length > 0 ? presentation.currentIndex + 1 : 0;
    elements.totalSlides.textContent = presentation.slides.length || 0;
}

function setupEventListeners() {
    // File selection
    elements.presentationFile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            loadPresentation(file);
        }
    });
    
    // Navigation buttons
    elements.prevBtn.addEventListener('click', prevSlide);
    elements.nextBtn.addEventListener('click', nextSlide);
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    
    // Handle audio ended event
    elements.currentAudio.addEventListener('ended', () => {
        if (presentation.isPlaying) {
            nextSlide();
        }
    });
    
    // Handle video ended event
    elements.currentVideo.addEventListener('ended', () => {
        if (presentation.isPlaying) {
            nextSlide();
        }
    });
    
    // Handle when audio metadata is loaded
    elements.currentAudio.addEventListener('loadedmetadata', () => {
        if (presentation.isPlaying) {
            clearTimers();
            startSequence();
        }
    });
    
    // Handle when video metadata is loaded
    elements.currentVideo.addEventListener('loadedmetadata', () => {
        if (presentation.isPlaying) {
            clearTimers();
            startSequence();
        }
    });
}

// Initialize the player
init();