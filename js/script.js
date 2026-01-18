document.addEventListener('DOMContentLoaded', () => {
    // A variável `propertiesData` já está disponível globalmente a partir de index.html

    function getYouTubeVideoId(url) {
        let videoId = '';
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === 'youtu.be') {
                videoId = urlObj.pathname.slice(1);
            } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
                videoId = urlObj.searchParams.get('v');
            }
        } catch (e) {
            console.error('Invalid URL for YouTube video', e);
        }
        return videoId;
    }

    // --- Elementos do DOM ---
    const modal = document.getElementById('gallery-modal');
    const mainImageContainer = document.querySelector('.main-image-container');
    const thumbnailContainer = document.querySelector('.thumbnail-gallery');
    const closeModalButton = modal.querySelector('.modal-close');
    const productsGrid = document.querySelector('.products-grid');

    // --- Estado do Zoom e Pan ---
    let scale = 1;
    let isPanning = false;
    let startPos = { x: 0, y: 0 };
    let currentTranslate = { x: 0, y: 0 };
    let initialTranslate = { x: 0, y: 0 };
    let ignoreNextClick = false;

    // Reference to the currently displayed media element (image or video)
    let currentMainMediaElement = null;

    const applyTransform = () => {
        if (currentMainMediaElement && currentMainMediaElement.tagName === 'IMG') {
            currentMainMediaElement.style.transform = `
                translate(${currentTranslate.x}px, ${currentTranslate.y}px)
                scale(${scale})
            `;
        }
    };


    const resetZoomAndPan = () => {
        scale = 1;
        currentTranslate = { x: 0, y: 0 };
        isPanning = false;
        if (currentMainMediaElement && currentMainMediaElement.tagName === 'IMG') {
            currentMainMediaElement.style.cursor = 'grab';
            currentMainMediaElement.style.transformOrigin = '0 0'; // Set transform origin to top-left for images
            applyTransform();
        }
    };

    // --- Funções do Modal e Galeria ---
    // New function to display main media (image or video)
    const displayMainMedia = (src, type = 'image') => {
        mainImageContainer.innerHTML = ''; // Clear previous content
        currentMainMediaElement = null; // Reset reference

        if (type === 'image') {
            const imgElement = document.createElement('img');
            imgElement.id = 'main-modal-image';
            imgElement.src = src;
            imgElement.alt = 'Imagem do imóvel';
            mainImageContainer.appendChild(imgElement);
            currentMainMediaElement = imgElement;
            resetZoomAndPan();
            mainImageContainer.style.cursor = 'grab';
        } else if (type === 'video') {
            const videoId = getYouTubeVideoId(src);
            if (videoId) {
                const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&origin=*`;
                const iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                iframe.setAttribute('allowfullscreen', '');
                mainImageContainer.appendChild(iframe);
                currentMainMediaElement = iframe;
                mainImageContainer.style.cursor = 'default';
            }
        }
    };

    // --- Funções do Modal e Galeria ---
    const openModal = async (property) => {
        thumbnailContainer.innerHTML = ''; // Clear existing thumbnails

        // Create a gallery that starts with the home image, and includes the gallery images without duplicates
        let mediaItems = property.gallery.map(src => ({
            src,
            type: 'image'
        }));


        // Add video to the beginning of the media items if it exists
        if (property.youtube_link) {
            mediaItems.unshift({ src: property.youtube_link, type: 'video' });
        }

        mediaItems.forEach((mediaItem, index) => {
            const thumb = document.createElement('img');
            if (mediaItem.type === 'video') {
                const videoId = getYouTubeVideoId(mediaItem.src);
                if (videoId) {
                    thumb.src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
                }
            } else {
                thumb.src = mediaItem.src;
            }
            thumb.alt = `Media ${index + 1} de ${property.name}`;
            thumb.dataset.index = index;
            thumb.dataset.type = mediaItem.type;
            thumb.dataset.src = mediaItem.src;
            if (index === 0) {
                thumb.classList.add('active');
            }
            thumbnailContainer.appendChild(thumb);
        });

        // Display initial main media
        if (mediaItems.length > 0) {
            displayMainMedia(mediaItems[0].src, mediaItems[0].type);
        }

        modal.classList.add('active');
    };

    const closeModal = () => {
        modal.classList.remove('active');
        mainImageContainer.innerHTML = ''; // Clear the media
        // A redefinição agora é feita ao abrir para evitar um "flash" da imagem resetada antes de fechar
    };

    const populateProperties = () => {
        if (!productsGrid) return;
        productsGrid.innerHTML = '';

        propertiesData.forEach(prop => {
            const propertyCard = document.createElement('article');
            propertyCard.className = 'product-card';
            propertyCard.innerHTML = `
                <img src="${prop.home}" alt="Fachada do ${prop.name}">
                <div class="product-info">
                    <h4>${prop.name.replace(/_/g, ' ')}</h4>
                    <a href="#" class="view-more-button" data-prop-id="${prop.id}">Ver mais</a>
                </div>
            `;
            productsGrid.appendChild(propertyCard);
        });
    };

    // --- Listeners de Eventos ---

    // Popula os imóveis
    populateProperties();

    // Abrir o modal
    productsGrid.addEventListener('click', (e) => {
        if (e.target.matches('.view-more-button')) {
            e.preventDefault();
            const propId = parseInt(e.target.dataset.propId, 10);
            const property = propertiesData.find(p => p.id === propId);
            if (property) openModal(property);
        }
    });

    // Fechar o modal
    closeModalButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (ignoreNextClick) {
            ignoreNextClick = false; // Reset flag after checking
            return;
        }
        // Só fecha o modal se o clique for diretamente no overlay E não estiver arrastando (panning)
        if (e.target === modal) closeModal();
    });

    // Trocar imagem/video pela miniatura
    thumbnailContainer.addEventListener('click', (e) => {
        let clickedElement = e.target.closest('img');

        if (clickedElement) {
            thumbnailContainer.querySelector('.active')?.classList.remove('active');
            clickedElement.classList.add('active');

            const src = clickedElement.dataset.src;
            const type = clickedElement.dataset.type;
            displayMainMedia(src, type);
        }
    });

    // --- Lógica de Zoom (Wheel) ---
    // mainModalImage.style.transformOrigin = '0 0'; // Handled in displayMainMedia for images

    mainImageContainer.addEventListener('wheel', (e) => {
        // Only apply zoom to images
        if (!currentMainMediaElement || currentMainMediaElement.tagName !== 'IMG') return;

        e.preventDefault();

        const rect = mainImageContainer.getBoundingClientRect();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = 1.15;
        const oldScale = scale;

        if (e.deltaY < 0) {
            scale *= zoomFactor;
        } else {
            scale /= zoomFactor;
        }

        scale = Math.min(Math.max(1, scale), 5);

        const scaleRatio = scale / oldScale;

        currentTranslate.x = mouseX - (mouseX - currentTranslate.x) * scaleRatio;
        currentTranslate.y = mouseY - (mouseY - currentTranslate.y) * scaleRatio;

        if (scale === 1) {
            currentTranslate = { x: 0, y: 0 };
        }

        clampPan();
        applyTransform();

    });


    // --- Lógica de Pan (Mouse Drag) ---
    mainImageContainer.addEventListener('mousedown', (e) => {
        // Only apply pan to images and if scaled
        if (scale > 1 && currentMainMediaElement && currentMainMediaElement.tagName === 'IMG') {
            e.preventDefault();
            isPanning = true;
            startPos = { x: e.clientX, y: e.clientY };
            initialTranslate = { ...currentTranslate };
            currentMainMediaElement.style.cursor = 'grabbing';
            mainImageContainer.style.cursor = 'grabbing';

            document.addEventListener('mousemove', handleDocumentMouseMove);
            document.addEventListener('mouseup', handleDocumentMouseUp);
        }
    });

    const handleDocumentMouseMove = (e) => {
        if (isPanning && currentMainMediaElement && currentMainMediaElement.tagName === 'IMG') {
            e.preventDefault();
            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;
            let newTranslateX = initialTranslate.x + dx;
            let newTranslateY = initialTranslate.y + dy;

            // Apply panning limits
            const containerWidth = mainImageContainer.clientWidth;
            const containerHeight = mainImageContainer.clientHeight;

            const imageAspect = currentMainMediaElement.naturalWidth / currentMainMediaElement.naturalHeight;

            let baseWidth = containerWidth;
            let baseHeight = containerHeight;

            if (containerWidth / containerHeight > imageAspect) {
                baseWidth = containerHeight * imageAspect;
            } else {
                baseHeight = containerWidth / imageAspect;
            }

            const scaledWidth = baseWidth * scale;
            const scaledHeight = baseHeight * scale;

            // LIMITES ABSOLUTOS (top-left origin)
            const minX = Math.min(0, containerWidth - scaledWidth);
            const minY = Math.min(0, containerHeight - scaledHeight);
            const maxX = 0;
            const maxY = 0;

            currentTranslate.x = Math.max(minX, Math.min(maxX, newTranslateX));
            currentTranslate.y = Math.max(minY, Math.min(maxY, newTranslateY));


            applyTransform();
        }
    };

    const handleDocumentMouseUp = () => {
        stopPanning();
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);

        // Set flag to ignore the next click event that might be fired right after mouseup
        ignoreNextClick = true;
        setTimeout(() => {
            ignoreNextClick = false;
        }, 100); // Give enough time for the click event to fire, but not too long
    };

    const stopPanning = () => {
        if (isPanning) {
            isPanning = false;
            if (currentMainMediaElement && currentMainMediaElement.tagName === 'IMG') {
                currentMainMediaElement.style.cursor = 'grab';
            }
            mainImageContainer.style.cursor = 'default';
        }
    };

    const clampPan = () => {
        if (!currentMainMediaElement || currentMainMediaElement.tagName !== 'IMG') return;

        const containerWidth = mainImageContainer.clientWidth;
        const containerHeight = mainImageContainer.clientHeight;

        const imageAspect = currentMainMediaElement.naturalWidth / currentMainMediaElement.naturalHeight;

        let baseWidth = containerWidth;
        let baseHeight = containerHeight;

        if (containerWidth / containerHeight > imageAspect) {
            baseWidth = containerHeight * imageAspect;
        } else {
            baseHeight = containerWidth / imageAspect;
        }

        const scaledWidth = baseWidth * scale;
        const scaledHeight = baseHeight * scale;

        const minX = Math.min(0, containerWidth - scaledWidth);
        const minY = Math.min(0, containerHeight - scaledHeight);
        const maxX = 0;
        const maxY = 0;

        currentTranslate.x = Math.max(minX, Math.min(maxX, currentTranslate.x));
        currentTranslate.y = Math.max(minY, Math.min(maxY, currentTranslate.y));
    };


    // Event listeners for panning will be managed on the document level when panning starts

    // Initial check for image load to get natural dimensions - now handled by displayMainMedia for images
    // mainModalImage.onload is removed
});
