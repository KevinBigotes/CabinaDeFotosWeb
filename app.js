    'use strict';
    const $ = id => document.getElementById(id);
    const canvas = $('canvas');
    const ctx = canvas.getContext('2d');
    const original = document.createElement('canvas');
    const filtered = document.createElement('canvas');
    const originalCtx = original.getContext('2d');
    const filteredCtx = filtered.getContext('2d');
    const state = { hasPhoto:false, photos:[], filter:'none', stickers:[], selected:null, drag:null };
    const filterValues = { none:'none', grayscale:'grayscale(1)', sepia:'sepia(1)', invert:'invert(1)', contrast:'contrast(1.8)', blur:'blur(5px)' };
    let stream = null;
    let cameraRequest = 0;
    let imageRequest = 0;
    let nextStickerId = 1;
    const STRIP = { width:720, margin:36, photoWidth:648, photoHeight:486, gap:24, footer:168, count:4 };
    const stripHeight = STRIP.margin + STRIP.count * STRIP.photoHeight + (STRIP.count - 1) * STRIP.gap + STRIP.footer;
    let capturing = false;

    function announce(message, error = false) {
      $('status').textContent = message;
      $('status').dataset.error = String(error);
    }

    function selectedSticker() { return state.stickers.find(sticker => sticker.id === state.selected); }

    function updateControls() {
      document.querySelectorAll('.filter,.sticker').forEach(button => button.disabled = !state.hasPhoto);
      document.querySelectorAll('.filter').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter)));
      $('download').disabled = state.photos.length !== STRIP.count;
      $('reset').disabled = !state.hasPhoto;
      $('upload').disabled = state.photos.length === STRIP.count;
      $('dimensions').textContent = `${state.photos.length} DE 4 FOTOS`;
      $('photoCount').textContent = state.photos.length === STRIP.count
        ? 'Tu tira está completa. Prueba un filtro o añade stickers.'
        : `${state.photos.length} de 4 fotos. Añade ${STRIP.count - state.photos.length} más; se recortan al centro.`;
      const selected = selectedSticker();
      $('size').disabled = $('remove').disabled = !selected;
      $('size').value = selected ? selected.scale : 15;
      $('sizeValue').textContent = $('size').value + '%';
    }

    // Cada cuadro conserva una copia sin filtros, recortada en proporción 4:3.
    function makePhoto(source, width, height, mirror = false) {
      if (!width || !height) throw new Error('Imagen sin dimensiones');
      const photo = document.createElement('canvas');
      photo.width = STRIP.photoWidth;
      photo.height = STRIP.photoHeight;
      const context = photo.getContext('2d');
      const scale = Math.max(photo.width / width, photo.height / height);
      const cropWidth = photo.width / scale, cropHeight = photo.height / scale;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, photo.width, photo.height);
      if (mirror) { context.translate(photo.width, 0); context.scale(-1, 1); }
      context.drawImage(source, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, photo.width, photo.height);
      return photo;
    }

    function setPhotos(photos, replace = false) {
      endDrag();
      state.photos = (replace ? photos : state.photos.concat(photos)).slice(0, STRIP.count);
      canvas.width = STRIP.width;
      canvas.height = stripHeight;
      original.width = filtered.width = STRIP.photoWidth;
      original.height = filtered.height = STRIP.photoHeight * STRIP.count;
      originalCtx.clearRect(0, 0, original.width, original.height);
      state.photos.forEach((photo, index) => originalCtx.drawImage(photo, 0, index * STRIP.photoHeight));
      state.hasPhoto = state.photos.length > 0;
      if (replace) { state.filter = 'none'; state.stickers = []; state.selected = null; }
      $('empty').hidden = state.hasPhoto;
      canvas.hidden = !state.hasPhoto;
      $('canvasHint').textContent = state.photos.length === STRIP.count ? 'Tu tira está lista. Dale tu estilo.' : 'Completa los cuatro momentos de tu tira.';
      updateFilteredPhoto();
      updateControls();
      render();
      announce(state.photos.length === STRIP.count ? '¡Tira completa! Personalízala y descarga tu recuerdo.' : `${state.photos.length} de 4 fotos listas. Añade las que faltan.`);
    }

    // La foto filtrada se calcula solo al cambiar el filtro, no en cada arrastre.
    function updateFilteredPhoto() {
      filteredCtx.clearRect(0, 0, filtered.width, filtered.height);
      if ('filter' in filteredCtx) {
        filteredCtx.save();
        filteredCtx.filter = filterValues[state.filter];
        filteredCtx.drawImage(original, 0, 0);
        filteredCtx.restore();
      } else {
        filteredCtx.drawImage(original, 0, 0);
        if (state.filter !== 'none') applyPixelFilter();
      }
    }

    // Alternativa para navegadores sin filtros nativos de canvas.
    function applyPixelFilter() {
      const image = filteredCtx.getImageData(0, 0, filtered.width, filtered.height);
      const data = image.data;
      if (state.filter === 'blur') {
        // Desenfoque separable con ventana móvil y alfa premultiplicado.
        const w = image.width, h = image.height, radius = 5;
        let src = new Float32Array(data.length);
        let dst = new Float32Array(data.length);
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] / 255;
          src[i] = data[i] * alpha; src[i + 1] = data[i + 1] * alpha;
          src[i + 2] = data[i + 2] * alpha; src[i + 3] = data[i + 3];
        }
        for (const horizontal of [true, false]) {
          const lines = horizontal ? h : w, length = horizontal ? w : h;
          const index = (line, position) => horizontal ? (line * w + position) * 4 : (position * w + line) * 4;
          for (let line = 0; line < lines; line++) {
            const sums = [0, 0, 0, 0];
            for (let k = -radius; k <= radius; k++) {
              const i = index(line, Math.max(0, Math.min(length - 1, k)));
              for (let c = 0; c < 4; c++) sums[c] += src[i + c];
            }
            for (let p = 0; p < length; p++) {
              const i = index(line, p);
              const left = index(line, Math.max(0, p - radius));
              const right = index(line, Math.min(length - 1, p + radius + 1));
              for (let c = 0; c < 4; c++) {
                dst[i + c] = sums[c] / (radius * 2 + 1);
                sums[c] += src[right + c] - src[left + c];
              }
            }
          }
          [src, dst] = [dst, src];
        }
        for (let i = 0; i < data.length; i += 4) {
          const alpha = src[i + 3] / 255;
          for (let c = 0; c < 3; c++) data[i + c] = alpha ? src[i + c] / alpha : 0;
          data[i + 3] = src[i + 3];
        }
      } else {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (state.filter === 'grayscale') data[i] = data[i + 1] = data[i + 2] = .2126 * r + .7152 * g + .0722 * b;
          if (state.filter === 'sepia') { data[i] = .393*r + .769*g + .189*b; data[i+1] = .349*r + .686*g + .168*b; data[i+2] = .272*r + .534*g + .131*b; }
          if (state.filter === 'invert') { data[i] = 255-r; data[i+1] = 255-g; data[i+2] = 255-b; }
          if (state.filter === 'contrast') { data[i] = (r-127.5)*1.8+127.5; data[i+1] = (g-127.5)*1.8+127.5; data[i+2] = (b-127.5)*1.8+127.5; }
        }
      }
      filteredCtx.putImageData(image, 0, 0);
    }

    function stickerSize(sticker) { return Math.min(canvas.width, canvas.height) * sticker.scale / 100; }

    // Cada cambio recompone foto + stickers; el marco de selección es opcional.
    function render(showSelection = true) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!state.hasPhoto) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < STRIP.count; index++) {
        const y = STRIP.margin + index * (STRIP.photoHeight + STRIP.gap);
        if (state.photos[index]) {
          ctx.drawImage(filtered, 0, index * STRIP.photoHeight, STRIP.photoWidth, STRIP.photoHeight, STRIP.margin, y, STRIP.photoWidth, STRIP.photoHeight);
        } else {
          ctx.fillStyle = '#edf0e8';
          ctx.fillRect(STRIP.margin, y, STRIP.photoWidth, STRIP.photoHeight);
          ctx.fillStyle = '#7c8568'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(`TU FOTO ${index + 1}`, canvas.width / 2, y + STRIP.photoHeight / 2);
        }
      }
      ctx.fillStyle = '#204c40'; ctx.textAlign = 'center';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText('FotoClub ✳', canvas.width / 2, canvas.height - 83);
      ctx.fillStyle = '#697971'; ctx.font = '17px sans-serif';
      ctx.fillText('CUATRO MOMENTOS · UN RECUERDO', canvas.width / 2, canvas.height - 44);
      for (const sticker of state.stickers) {
        const size = stickerSize(sticker);
        ctx.save();
        ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker.emoji, sticker.x, sticker.y);
        if (showSelection && sticker.id === state.selected) {
          ctx.strokeStyle = '#d9ef95';
          ctx.lineWidth = Math.max(2, canvas.width / 650);
          ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
          ctx.strokeRect(sticker.x - size * .6, sticker.y - size * .6, size * 1.2, size * 1.2);
        }
        ctx.restore();
      }
    }

    $('upload').addEventListener('click', () => $('file').click());
    $('emptyUpload').addEventListener('click', () => $('file').click());
    $('emptyCamera').addEventListener('click', () => $('camera').click());
    $('reset').addEventListener('click', () => {
      ++imageRequest;
      setPhotos([], true);
      announce('Una tira nueva. Entra a la cabina o añade tus fotos.');
    });
    $('file').addEventListener('change', async event => {
      const files = Array.from(event.target.files);
      event.target.value = '';
      const remaining = STRIP.count - state.photos.length;
      if (!files.length || !remaining) return;
      const request = ++imageRequest;
      const photos = [];
      let failures = 0;
      announce('Preparando tus fotos…');
      for (const file of files.slice(0, remaining)) {
        if (request !== imageRequest) return;
        const url = URL.createObjectURL(file);
        try {
          if (file.type && !file.type.startsWith('image/')) throw new Error('Formato inválido');
          const image = new Image();
          image.src = url;
          await image.decode();
          photos.push(makePhoto(image, image.naturalWidth, image.naturalHeight));
        } catch { failures++; }
        finally { URL.revokeObjectURL(url); }
      }
      if (request !== imageRequest) return;
      if (photos.length) setPhotos(photos);
      if (failures) announce(`${failures} archivo(s) no se pudieron abrir. Prueba con JPEG, PNG o WebP.`, true);
      else if (files.length > remaining) announce('Se añadieron solo las fotos que caben en la tira, en el orden seleccionado.');
    });

    $('filters').addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button || !state.hasPhoto) return;
      state.filter = button.dataset.filter;
      updateFilteredPhoto(); updateControls(); render();
      announce(`Filtro: ${button.textContent.trim()}.`);
    });
    $('stickers').addEventListener('click', event => {
      const button = event.target.closest('[data-emoji]');
      if (!button || !state.hasPhoto) return;
      const offset = (state.stickers.length % 5) * Math.min(canvas.width, canvas.height) * .035;
      const sticker = { id:nextStickerId++, emoji:button.dataset.emoji, x:canvas.width / 2 + offset, y:canvas.height / 2 + offset, scale:15 };
      state.stickers.push(sticker); state.selected = sticker.id;
      updateControls(); render(); canvas.focus({ preventScroll:true });
      announce('Sticker añadido. Arrástralo o muévelo con las flechas del teclado.');
    });

    // Convertimos coordenadas de pantalla a píxeles reales del canvas responsive.
    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return { x:(event.clientX - rect.left) * canvas.width / rect.width, y:(event.clientY - rect.top) * canvas.height / rect.height };
    }
    function hitSticker(point) {
      return [...state.stickers].reverse().find(sticker => Math.abs(point.x - sticker.x) <= stickerSize(sticker) * .6 && Math.abs(point.y - sticker.y) <= stickerSize(sticker) * .6);
    }
    function placeSticker(sticker, x, y) {
      sticker.x = Math.max(0, Math.min(canvas.width, x));
      sticker.y = Math.max(0, Math.min(canvas.height, y));
    }
    canvas.addEventListener('pointerdown', event => {
      if (!state.hasPhoto || state.drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const point = canvasPoint(event), sticker = hitSticker(point);
      state.selected = sticker ? sticker.id : null;
      if (sticker) {
        // El sticker seleccionado pasa al frente y conserva el punto de agarre.
        state.stickers = state.stickers.filter(item => item.id !== sticker.id).concat(sticker);
        state.drag = { pointerId:event.pointerId, dx:point.x-sticker.x, dy:point.y-sticker.y };
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
      }
      canvas.focus({ preventScroll:true });
      updateControls(); render();
    });
    canvas.addEventListener('pointermove', event => {
      const point = canvasPoint(event);
      if (!state.drag) { canvas.style.cursor = hitSticker(point) ? 'grab' : 'default'; return; }
      if (event.pointerId !== state.drag.pointerId) return;
      const sticker = selectedSticker();
      if (!sticker) return;
      placeSticker(sticker, point.x-state.drag.dx, point.y-state.drag.dy);
      render();
    });
    function endDrag(event) {
      if (!state.drag || (event && event.pointerId !== state.drag.pointerId)) return;
      const pointerId = state.drag.pointerId;
      state.drag = null;
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      canvas.style.cursor = 'grab';
    }
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type, endDrag));
    function removeSelected() {
      endDrag();
      state.stickers = state.stickers.filter(sticker => sticker.id !== state.selected);
      state.selected = null; updateControls(); render();
      announce('Sticker eliminado.');
    }
    $('remove').addEventListener('click', removeSelected);
    $('size').addEventListener('input', event => {
      const sticker = selectedSticker();
      if (sticker) { sticker.scale = Number(event.target.value); updateControls(); render(); }
    });
    canvas.addEventListener('keydown', event => {
      const sticker = selectedSticker();
      if (!sticker) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); return; }
      if (event.key === 'Escape') { endDrag(); state.selected = null; updateControls(); render(); return; }
      const moves = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };
      if (moves[event.key]) {
        event.preventDefault();
        const step = (event.shiftKey ? 10 : 1) * canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
        placeSticker(sticker, sticker.x + moves[event.key][0] * step, sticker.y + moves[event.key][1] * step);
        render();
      }
    });

    function stopCamera() {
      ++cameraRequest;
      capturing = false;
      $('countdown').hidden = true;
      if (stream) stream.getTracks().forEach(track => track.stop());
      stream = null;
      $('video').srcObject = null;
      $('capture').disabled = true;
    }
    function closeCamera() { stopCamera(); $('cameraDialog').close(); }
    $('closeCamera').addEventListener('click', closeCamera);
    $('cameraDialog').addEventListener('cancel', event => { event.preventDefault(); closeCamera(); });
    $('cameraDialog').addEventListener('close', stopCamera);
    window.addEventListener('pagehide', stopCamera);
    $('camera').addEventListener('click', async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        announce('La cámara necesita un navegador compatible y una página en HTTPS o localhost. Puedes seguir subiendo fotos.', true);
        return;
      }
      $('cameraDialog').showModal();
      document.querySelectorAll('.camera-progress span').forEach(item => item.classList.remove('taken'));
      $('cameraStatus').textContent = 'Conectando con tu cámara…';
      $('capture').disabled = true;
      const request = ++cameraRequest;
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ ideal:1920 }, height:{ ideal:1080 } }, audio:false });
        // Si se cerró el diálogo mientras se pedía permiso, apagamos esa cámara.
        if (request !== cameraRequest || !$('cameraDialog').open) { media.getTracks().forEach(track => track.stop()); return; }
        stream = media;
        $('video').srcObject = media;
        await $('video').play();
        if (request !== cameraRequest) return;
        $('capture').disabled = !$('video').videoWidth;
        $('cameraStatus').textContent = '4 fotos nuevas · 3 segundos para cada pose. La sesión completa reemplaza tu tira.';
      } catch (error) {
        if (request !== cameraRequest) return;
        const messages = { NotAllowedError:'No se concedió permiso para usar la cámara. Puedes habilitarlo en tu navegador.', NotFoundError:'No se encontró una cámara conectada.', NotReadableError:'La cámara está ocupada o no está disponible.' };
        closeCamera();
        announce(messages[error.name] || 'No se pudo activar la cámara. Prueba de nuevo o sube una imagen.', true);
      }
    });
    $('video').addEventListener('loadeddata', () => {
      if (stream && $('cameraDialog').open && !capturing) $('capture').disabled = !$('video').videoWidth;
    });
    $('capture').addEventListener('click', async () => {
      const video = $('video');
      if (capturing || !stream || !video.videoWidth || video.readyState < 2) return;
      capturing = true;
      $('capture').disabled = true;
      ++imageRequest;
      const request = cameraRequest;
      const photos = [];
      const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
      try {
        for (let index = 0; index < STRIP.count; index++) {
          for (let count = 3; count > 0; count--) {
            if (request !== cameraRequest) return;
            $('countdown').hidden = false;
            $('countdown').textContent = count;
            $('cameraStatus').textContent = `Foto ${index + 1} de 4 en ${count}…`;
            await wait(1000);
          }
          if (request !== cameraRequest) return;
          if (video.readyState < 2 || !stream?.getVideoTracks().some(track => track.readyState === 'live')) throw new Error('Cámara desconectada');
          photos.push(makePhoto(video, video.videoWidth, video.videoHeight, true));
          $('countdown').textContent = '✓';
          document.querySelectorAll('.camera-progress span')[index].classList.add('taken');
          $('cameraStatus').textContent = `Foto ${index + 1} de 4 capturada. ¡Cambia de pose!`;
          await wait(350);
        }
        if (request !== cameraRequest) return;
        setPhotos(photos, true);
        closeCamera();
        announce('¡Sesión completa! Tus cuatro poses ya están en la tira.');
      } catch {
        if (request !== cameraRequest) return;
        closeCamera();
        announce('La sesión se interrumpió. Tu tira anterior sigue disponible; vuelve a intentar la cámara.', true);
      }
    });

    $('download').addEventListener('click', () => {
      if (state.photos.length !== STRIP.count) return;
      try {
        // Se exporta la composición completa sin el marco de selección.
        render(false);
        const link = document.createElement('a');
        link.download = `fotoclub-tira-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link); link.click(); link.remove();
        announce('Tu PNG está listo. Se ha solicitado la descarga.');
      } catch { announce('No se pudo exportar la tira. Inténtalo de nuevo.', true); }
      finally { render(); }
    });

