(() => {
  const video = document.getElementById('video');
  const shutter = document.getElementById('shutter');
  const flip = document.getElementById('flip');
  const flash = document.getElementById('flash');
  const gallery = document.getElementById('gallery');
  const empty = document.getElementById('empty');
  const canvas = document.getElementById('capture');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const viewer = document.getElementById('viewer');
  const viewerStack = document.getElementById('viewerStack');
  const viewerClose = document.getElementById('viewerClose');
  const viewerPrev = document.querySelector('.viewer-nav.prev');
  const viewerNext = document.querySelector('.viewer-nav.next');
  const viewerCounter = document.getElementById('viewerCounter');

    let usingFront = true;
let stream;
const STORAGE_KEY = 'polaroid-cam-v2'; // bump key for new schema
const STORAGE_VERSION = 1;

let currentIndex = -1;
let currentList = [];
let touchStartX = 0;
let store = { version: STORAGE_VERSION, items: [] };
let isAnimating = false;

  async function initCamera(){
    if (stream) { stream.getTracks().forEach(t => t.stop()); }
    try{
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: usingFront ? 'user' : 'environment',
          width: { ideal: 1920 }, height: { ideal: 1080 }
        },
        audio:false
      });
      video.srcObject = stream;
    }catch(err){
      console.error(err);
      alert('Could not access the camera: ' + err.message);
    }
  }

  function doFlash(){
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
  }

  // === SQUARE CAPTURE ===
  function takePhoto(){
    if(!video.videoWidth){ return; }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);      // square side
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    canvas.width = size;
    canvas.height = size;

    ctx.save();
    if (usingFront) {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    ctx.restore();

          const dataUrl = canvas.toDataURL('image/jpeg', .92);
    const polaroid = createPolaroid(dataUrl, true);
    gallery.prepend(polaroid);

    // Save temporarily without poem
    const obj = { img: dataUrl, poem: "", ts: Date.now() };
    savePhotoObject(obj);
    updateEmptyState();

    // Kick off poem generation (don't block the UI)
    generatePoemFor(dataUrl)
      .then(poem => {
        polaroid.__poemEl.textContent = poem;
        // Update store
        const idx = store.items.findIndex(i => i.img === dataUrl);
        if (idx !== -1) {
          store.items[idx].poem = poem;
          saveStore(store);
        }
      })
      .catch(err => {
        console.error(err);
        polaroid.__poemEl.textContent = "(couldn't write a poem 😢)";
      });

    doFlash();
    if (navigator.vibrate) navigator.vibrate(30);
  }

      function createPolaroid(src, isDeveloping=false, poem=""){
    const d = document.createElement('div');
    d.className = 'polaroid' + (isDeveloping ? ' developing' : '');
    d.style.setProperty('--rot', (Math.random()*2-1) + 'deg');

    const img = new Image();
    img.src = src;

    const poemEl = document.createElement('div');
    poemEl.className = 'caption-poem';
    poemEl.textContent = poem || (isDeveloping ? "writing a poem…" : "");

    const del = document.createElement('div');
    del.className = 'delete-ring';
    del.textContent = '×';
    del.addEventListener('click', e => {
      e.stopPropagation();
      deletePhoto(d, src);
    });

    // Long press to reveal delete
    let pressTimer;
    const startPress = ()=>{ pressTimer = setTimeout(()=> d.classList.add('show-delete'), 500); };
    const cancelPress = ()=>{ clearTimeout(pressTimer); };

    d.addEventListener('touchstart', startPress, {passive:true});
    d.addEventListener('touchend', cancelPress);
    d.addEventListener('mousedown', startPress);
    d.addEventListener('mouseup', cancelPress);
    d.addEventListener('mouseleave', cancelPress);

    // Open viewer on click
    d.addEventListener('click', () => {
      if (d.classList.contains('show-delete')) return;
      openViewer(src);
    });

    if (isDeveloping) {
      setTimeout(()=> d.classList.remove('developing'), 3300);
    }

    d.appendChild(img);
    d.appendChild(poemEl);
    d.appendChild(del);

    // attach a ref so we can update its poem later
    d.__poemEl = poemEl;

    return d;
  }

  function updateEmptyState(){
    empty.style.display = gallery.children.length > 0 ? 'none' : 'block';
  }

  function loadStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: STORAGE_VERSION, items: [] };

    try {
      const parsed = JSON.parse(raw);

      // new schema
      if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.items)) {
        return parsed;
      }

      // old schema migration (array of strings)
      if (Array.isArray(parsed)) {
        const migrated = {
          version: STORAGE_VERSION,
          items: parsed.map(img => ({ img, poem: "", ts: Date.now() }))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }

      // fallback
      return { version: STORAGE_VERSION, items: [] };
    } catch {
      return { version: STORAGE_VERSION, items: [] };
    }
  }

  function saveStore(storeData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storeData));
  }

  function savePhotoObject(obj) {
    store.items.unshift(obj);
    // soft cap
    store.items = store.items.slice(0, 100);
    saveStore(store);
  }

      function deletePhoto(node, dataUrl){
    node.remove();
    store.items = store.items.filter(item => item.img !== dataUrl);
    saveStore(store);
    updateEmptyState();

    if (viewer.classList.contains('open')) {
      const idx = currentList.indexOf(dataUrl);
      if (idx !== -1) {
        currentList.splice(idx, 1);
        if (currentList.length === 0) {
          closeViewer();
        } else {
          currentIndex = Math.min(currentIndex, currentList.length - 1);
          renderStack();
        }
      }
    }
  }

  function loadPhotos(){
    store = loadStore();
    store.items.forEach(item => {
      const node = createPolaroid(item.img, false, item.poem);
      gallery.appendChild(node);
    });
    updateEmptyState();
  }

  async function generatePoemFor(imgDataUrl){
    const res = await fetch('/api/poem', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ image_b64: imgDataUrl })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'poem api failed');
    return (json.poem || '').trim();
  }

  function getPoemForSrc(src){
    const item = store.items.find(i => i.img === src);
    return item?.poem || "";
  }

  /* ========= STACKED VIEWER ========= */
  function openViewer(src){
    currentList = store.items.map(i => i.img);
    currentIndex = Math.max(0, currentList.indexOf(src));
    viewer.classList.add('open');
    document.body.classList.add('no-scroll');
    renderStack();
  }

  function closeViewer(){
    viewer.classList.remove('open');
    document.body.classList.remove('no-scroll');
    viewerStack.innerHTML = '';
  }

  function nextPhoto(){
    if (currentIndex < currentList.length - 1) {
      animateTo(currentIndex + 1, +1); // +1 means we move forward → slide left
    }
  }
  function prevPhoto(){
    if (currentIndex > 0) {
      animateTo(currentIndex - 1, -1); // -1 means we move backward → slide right
    }
  }

  function buildViewerCard(src){
    const el = document.createElement('div');
    el.className = 'vpolaroid slide-active'; // gets the transition
    el.style.position = 'absolute';
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%)';

    const img = new Image();
    img.src = src;

    const poem = getPoemForSrc(src);
    const poemEl = document.createElement('div');
    poemEl.className = 'caption-poem';
    poemEl.textContent = poem || "";

    el.appendChild(img);
    el.appendChild(poemEl);
    return el;
  }

      function renderStack(){
    viewerStack.innerHTML = '';
    viewerCounter.textContent = `${currentIndex + 1} / ${currentList.length}`;

    const spread = 14;      // degree random spread for background cards
    const offset = 20;      // px jitter
    const scaleBack = 0.96; // background card scale

    currentList.forEach((src, i) => {
      const el = document.createElement('div');
      el.className = 'vpolaroid' + (i === currentIndex ? '' : ' behind');

      const img = new Image();
      img.src = src;

      const poem = getPoemForSrc(src);
      const poemEl = document.createElement('div');
      poemEl.className = 'caption-poem';
      poemEl.textContent = poem || "";

      el.appendChild(img);
      el.appendChild(poemEl);

      const dist = i - currentIndex;  // 0 = top
      const z = 100 - Math.abs(dist);

      let rot = 0, tx = 0, ty = 0, scale = 1;
      if (dist !== 0) {
        rot = (Math.random() * spread - spread/2);
        tx  = (Math.random() * offset - offset/2);
        ty  = (Math.random() * offset - offset/2);
        scale = scaleBack;
      }

      el.style.zIndex = z;
      el.style.transform = `translate(-50%,-50%) translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`;

      viewerStack.appendChild(el);
    });

    viewerPrev.style.opacity = (currentIndex === 0) ? .2 : 1;
    viewerNext.style.opacity = (currentIndex === currentList.length - 1) ? .2 : 1;
  }

  function animateTo(targetIndex, dir){
    if (isAnimating) return;
    isAnimating = true;

    const fromIndex = currentIndex;
    const toIndex   = targetIndex;

    const fromSrc = currentList[fromIndex];
    const toSrc   = currentList[toIndex];

    // Build two top cards only (old and new)
    const fromCard = buildViewerCard(fromSrc);
    const toCard   = buildViewerCard(toSrc);

    // Ensure clean container
    viewerStack.innerHTML = '';

    // Put the rest of the stack behind (optional for now: skip to keep simple & fast)
    // If you want to keep them, call renderStack() to background-only, but that's more code.
    // Simpler: just animate between two top cards, then re-render the full stack post-animation.

    // Start positions
    const W = window.innerWidth;
    const OFF = W * 1.2; // move completely offscreen

    fromCard.classList.add('slide-active');
    toCard.classList.add('slide-active');

    // fromCard starts centered
    fromCard.style.transform = 'translate(-50%, -50%)';
    fromCard.style.zIndex = 100;

    // toCard starts offscreen based on direction (+1 => from right, -1 => from left)
    toCard.style.transform = `translate(${dir > 0 ? OFF : -OFF}px, -50%)`;
    toCard.style.zIndex = 101;

    viewerStack.appendChild(fromCard);
    viewerStack.appendChild(toCard);

    // Trigger a reflow before we animate (forces the browser to apply initial transforms)
    void fromCard.offsetWidth;

    // Animate
    requestAnimationFrame(()=>{
      viewer.classList.add('animating');

      // Move fromCard offscreen opposite to dir
      fromCard.style.transform = `translate(${dir > 0 ? -OFF : OFF}px, -50%)`;

      // toCard to center
      toCard.style.transform = 'translate(-50%, -50%)';
    });

    // When the transition ends, finalize
    const onDone = () => {
      fromCard.removeEventListener('transitionend', onDone);
      currentIndex = toIndex;

      // Rebuild full stack (static) after the animated slide finishes
      renderStack();

      viewer.classList.remove('animating');
      isAnimating = false;
    };
    fromCard.addEventListener('transitionend', onDone);
  }

  // swipe handling
  viewer.addEventListener('touchstart', (e)=>{
    touchStartX = e.changedTouches[0].clientX;
  }, {passive:true});
  viewer.addEventListener('touchend', (e)=>{
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50){
      if (dx < 0) nextPhoto(); else prevPhoto();
    }
  });

  // clicking backdrop closes
  viewer.addEventListener('click', (e)=>{
    if (e.target === viewer) closeViewer();
  });
  viewerClose.addEventListener('click', closeViewer);
  viewerPrev.addEventListener('click', prevPhoto);
  viewerNext.addEventListener('click', nextPhoto);

  // keyboard support
  document.addEventListener('keydown', (e)=>{
    if (!viewer.classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
  });

  shutter.addEventListener('click', takePhoto);
  flip.addEventListener('click', async ()=>{
    usingFront = !usingFront;
    await initCamera();
    video.style.transform = usingFront ? 'scaleX(-1)' : 'scaleX(1)';
  });

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden) {
      stream?.getTracks().forEach(t=>t.stop());
    } else {
      initCamera();
    }
  });

  // bootstrap
  loadPhotos();
  initCamera();
})();
