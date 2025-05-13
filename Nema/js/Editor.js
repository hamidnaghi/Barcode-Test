// Current presentation data
let presentation = {
    slides: [],
    currentSlideIndex: 0
};

// DOM elements
const elements = {
    previewPane: document.getElementById('previewPane'),
    previewImage: document.getElementById('previewImage'),
    previewVideo: document.getElementById('previewVideo'),
    pointer: document.getElementById('pointer'),
    mediaFile: document.getElementById('mediaFile'),
    audioFile: document.getElementById('audioFile'),
    captionText: document.getElementById('captionText'),
    addPointBtn: document.getElementById('addPointBtn'),
    removePointBtn: document.getElementById('removePointBtn'),
    pointsTable: document.getElementById('pointsTable').querySelector('tbody'),
    prevSlideBtn: document.getElementById('prevSlideBtn'),
    nextSlideBtn: document.getElementById('nextSlideBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadBtn: document.getElementById('loadBtn'),
    currentSlideNumber: document.getElementById('currentSlideNumber'),
    totalSlides: document.getElementById('totalSlides')
};

// Initialize
function init() {
    // Add first empty slide
    addNewSlide();
    
    // Set up event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Media file selection
    elements.mediaFile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                if (file.type.startsWith('video/')) {
                    elements.previewImage.style.display = 'none';
                    elements.previewVideo.src = event.target.result;
                    elements.previewVideo.style.display = 'block';
                    presentation.slides[presentation.currentSlideIndex].mediaType = 'video';
                } else {
                    elements.previewVideo.style.display = 'none';
                    elements.previewImage.src = event.target.result;
                    elements.previewImage.style.display = 'block';
                    presentation.slides[presentation.currentSlideIndex].mediaType = 'image';
                }
                presentation.slides[presentation.currentSlideIndex].media = file.name;
            };
            reader.readAsDataURL(file);
        }
    });

    // Audio file selection
    elements.audioFile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            presentation.slides[presentation.currentSlideIndex].audio = file.name;
        }
    });

    // Caption editing
    elements.captionText.addEventListener('input', function() {
        presentation.slides[presentation.currentSlideIndex].caption = this.value;
    });

    // Add point button
    elements.addPointBtn.addEventListener('click', function() {
        const slide = presentation.slides[presentation.currentSlideIndex];
        if (slide.mediaType === 'video') return;
        if (!slide.pointerPath) slide.pointerPath = [];
        slide.pointerPath.push({ x: 50, y: 50, wait: 3000 });
        updatePointsTable();
        previewPoint(slide.pointerPath[slide.pointerPath.length - 1]);
    });

    // Remove point button
    elements.removePointBtn.addEventListener('click', function() {
        const slide = presentation.slides[presentation.currentSlideIndex];
        if (slide.pointerPath && slide.pointerPath.length > 0) {
            slide.pointerPath.pop();
            updatePointsTable();
        }
    });

    // Precise click handler for point placement
    elements.previewPane.addEventListener('click', function(e) {
        const slide = presentation.slides[presentation.currentSlideIndex];
        if (slide.mediaType === 'video') return;
        
        if (e.target === elements.previewImage) {
            const img = elements.previewImage;
            const container = elements.previewPane;
            const imgRect = img.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Calculate actual displayed image area
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
            
            // Calculate click position relative to container
            const clickX = e.clientX - containerRect.left;
            const clickY = e.clientY - containerRect.top;
            
            // Only register clicks on the actual image
            if (clickX >= offsetX && clickX <= offsetX + displayedWidth &&
                clickY >= offsetY && clickY <= offsetY + displayedHeight) {
                
                // Convert to percentage coordinates (0-100%)
                const x = ((clickX - offsetX) / displayedWidth) * 100;
                const y = ((clickY - offsetY) / displayedHeight) * 100;
                
                if (!slide.pointerPath) slide.pointerPath = [];
                slide.pointerPath.push({ 
                    x: Math.round(x * 100) / 100,
                    y: Math.round(y * 100) / 100,
                    wait: 3000 
                });
                updatePointsTable();
                previewPoint(slide.pointerPath[slide.pointerPath.length - 1]);
            }
        }
    });

    // Navigation buttons
    elements.prevSlideBtn.addEventListener('click', prevSlide);
    elements.nextSlideBtn.addEventListener('click', nextSlide);

    // Save/Load buttons
    elements.saveBtn.addEventListener('click', savePresentation);
    elements.loadBtn.addEventListener('click', loadPresentation);
}

function addNewSlide() {
    presentation.slides.push({
        media: '',
        mediaType: 'image',
        audio: '',
        caption: '',
        pointerPath: []
    });
    presentation.currentSlideIndex = presentation.slides.length - 1;
    updateUI();
}

function updateUI() {
    const slide = presentation.slides[presentation.currentSlideIndex];
    
    // Update media preview
    if (slide.mediaType === 'video') {
        elements.previewImage.style.display = 'none';
        elements.previewVideo.style.display = 'block';
        elements.previewVideo.src = slide.media;
    } else {
        elements.previewVideo.style.display = 'none';
        elements.previewImage.style.display = 'block';
        elements.previewImage.src = slide.media;
    }
    
    // Update form fields
    elements.captionText.value = slide.caption || '';
    elements.mediaFile.value = '';
    elements.audioFile.value = '';
    
    // Update points table
    updatePointsTable();
    
    // Update slide counter
    elements.currentSlideNumber.textContent = presentation.currentSlideIndex + 1;
    elements.totalSlides.textContent = presentation.slides.length;
    
    // Update button states
    elements.prevSlideBtn.disabled = presentation.currentSlideIndex === 0;
    elements.removePointBtn.disabled = !slide.pointerPath || slide.pointerPath.length === 0 || slide.mediaType === 'video';
    elements.addPointBtn.disabled = slide.mediaType === 'video';
}

function updatePointsTable() {
    const slide = presentation.slides[presentation.currentSlideIndex];
    elements.pointsTable.innerHTML = '';
    
    if (!slide.pointerPath || slide.pointerPath.length === 0 || slide.mediaType === 'video') {
        elements.removePointBtn.disabled = true;
        return;
    }
    
    slide.pointerPath.forEach((point, index) => {
        const row = document.createElement('tr');
        
        // X position
        const xCell = document.createElement('td');
        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.min = '0';
        xInput.max = '100';
        xInput.value = point.x;
        xInput.addEventListener('change', function() {
            point.x = parseInt(this.value) || 0;
        });
        xCell.appendChild(xInput);
        
        // Y position
        const yCell = document.createElement('td');
        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.min = '0';
        yInput.max = '100';
        yInput.value = point.y;
        yInput.addEventListener('change', function() {
            point.y = parseInt(this.value) || 0;
        });
        yCell.appendChild(yInput);
        
        // Wait time
        const waitCell = document.createElement('td');
        const waitInput = document.createElement('input');
        waitInput.type = 'number';
        waitInput.min = '0';
        waitInput.value = point.wait;
        waitInput.addEventListener('change', function() {
            point.wait = parseInt(this.value) || 0;
        });
        waitCell.appendChild(waitInput);
        
        // Actions
        const actionsCell = document.createElement('td');
        const previewBtn = document.createElement('button');
        previewBtn.textContent = 'Preview';
        previewBtn.style.backgroundColor = '#9b59b6';
        previewBtn.style.padding = '5px 10px';
        previewBtn.addEventListener('click', function() {
            previewPoint(point);
        });
        actionsCell.appendChild(previewBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.backgroundColor = '#e74c3c';
        deleteBtn.style.padding = '5px 10px';
        deleteBtn.style.marginLeft = '5px';
        deleteBtn.addEventListener('click', function() {
            slide.pointerPath.splice(index, 1);
            updatePointsTable();
        });
        actionsCell.appendChild(deleteBtn);
        
        // Build row
        row.appendChild(xCell);
        row.appendChild(yCell);
        row.appendChild(waitCell);
        row.appendChild(actionsCell);
        
        elements.pointsTable.appendChild(row);
    });
    
    elements.removePointBtn.disabled = slide.pointerPath.length === 0 || slide.mediaType === 'video';
}

function previewPoint(point) {
    const img = elements.previewImage;
    const container = elements.previewPane;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Recalculate the displayed image area
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
    const xPos = containerRect.left + offsetX + (point.x / 100) * displayedWidth;
    const yPos = containerRect.top + offsetY + (point.y / 100) * displayedHeight;
    
    // Position pointer absolutely
    elements.pointer.style.position = 'fixed';
    elements.pointer.style.left = `${xPos}px`;
    elements.pointer.style.top = `${yPos}px`;
    elements.pointer.style.display = 'block';
    
    setTimeout(() => {
        elements.pointer.style.display = 'none';
    }, 2000);
}

function prevSlide() {
    if (presentation.currentSlideIndex > 0) {
        presentation.currentSlideIndex--;
        updateUI();
    }
}

function nextSlide() {
    if (presentation.currentSlideIndex < presentation.slides.length - 1) {
        presentation.currentSlideIndex++;
        updateUI();
    } else {
        addNewSlide();
    }
}

function savePresentation() {
    // Prepare the complete presentation data
    const presentationData = {
        slides: presentation.slides,
        version: "1.0",
        created: new Date().toISOString()
    };

    const dataStr = JSON.stringify(presentationData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadPresentation() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        
        reader.onload = readerEvent => {
            try {
                const content = readerEvent.target.result;
                const loadedData = JSON.parse(content);
                
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
                
                presentation.currentSlideIndex = 0;
                updateUI();
            } catch (error) {
                alert('Error loading file: ' + error.message);
            }
        };
    };
    
    input.click();
}

// Initialize the editor
init();