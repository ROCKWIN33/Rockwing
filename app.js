(() => {
  const app = document.getElementById("app");
  const params = new URLSearchParams(location.search);
  const message = params.get("message");
  const photoUrl = params.get("photo");

  if (message !== null || photoUrl !== null) {
    renderCustomer(message || "", photoUrl || "");
  } else {
    renderAdmin();
  }

  function renderAdmin() {
    app.innerHTML = `
      <main class="screen admin">
        <header class="header">
          <div>
            <div class="logo">SMILE</div>
            <div class="sub">Admin / Product Owner</div>
          </div>
          <span class="badge">ADMIN</span>
        </header>

        <section class="camera-wrap">
          <video id="video" autoplay playsinline muted></video>
          <div class="guide"></div>
          <div id="cameraStatus" class="camera-status">Starting camera…</div>
        </section>

        <button id="capture" class="shutter" aria-label="Capture photo"><span></span></button>

        <section id="capturedStep" class="card captured-card hidden">
          <div class="step">PHOTO CAPTURED</div>
          <img id="capturedPreview" class="captured-preview" alt="Captured photo preview">
          <div id="photoStatus" class="photo-status">Is this photo correct?</div>
          <div class="photo-actions">
            <button id="confirmPhotoBtn" class="primary" type="button">Yes, Save Photo</button>
            <button id="retakePhotoBtn" class="secondary" type="button">Retake Photo</button>
          </div>
        </section>

        <section id="savedPhotoStep" class="card hidden">
          <div class="step">PHOTO SAVED</div>
          <h2>Photo is ready</h2>
          <p id="uploadStatus">Preparing photo upload…</p>
          <div class="photo-actions">
            <button id="retryUploadBtn" class="secondary hidden" type="button">Retry GitHub Upload</button>
            <button id="continueBtn" class="primary hidden" type="button">Continue to Message</button>
            <button id="takeAnotherSavedBtn" class="secondary hidden" type="button">Take Another Photo</button>
          </div>
        </section>

        <section id="messageStep" class="card hidden">
          <div class="step">STEP 2</div>
          <h1>What should we display?</h1>
          <p>Enter the message your customer should see after scanning the QR code.</p>
          <textarea id="messageInput" maxlength="500" placeholder="Type your message here…"></textarea>
          <div class="counter"><span id="count">0</span>/500</div>
          <button id="generate" class="primary">Generate QR Code</button>
        </section>

        <section id="qrStep" class="card qr-card hidden">
          <div class="step">STEP 3</div>
          <h1>Show this QR to your customer</h1>
          <div id="qr"></div>
          <div class="message-preview" id="messagePreview"></div>
          <p class="hint">The QR opens the Smile page and displays the saved GitHub photo plus your message.</p>
          <button id="shareQr" class="primary share-qr-btn" type="button">Share QR Code</button>
          <button id="newPhoto" class="secondary">Take Another Photo</button>
        </section>

        <section class="saved card">
          <div class="step">ADMIN STORAGE</div>
          <h2>Captured photos</h2>
          <p>Confirmed photos are kept in this phone's browser storage as a backup and uploaded to GitHub when configured.</p>
          <div id="gallery" class="gallery"></div>
          <div id="empty" class="empty">No photos captured yet.</div>
        </section>
      </main>
    `;

    const video = document.getElementById("video");
    const capture = document.getElementById("capture");
    const capturedStep = document.getElementById("capturedStep");
    const capturedPreview = document.getElementById("capturedPreview");
    const photoStatus = document.getElementById("photoStatus");
    const confirmPhotoBtn = document.getElementById("confirmPhotoBtn");
    const retakePhotoBtn = document.getElementById("retakePhotoBtn");
    const savedPhotoStep = document.getElementById("savedPhotoStep");
    const uploadStatus = document.getElementById("uploadStatus");
    const retryUploadBtn = document.getElementById("retryUploadBtn");
    const continueBtn = document.getElementById("continueBtn");
    const takeAnotherSavedBtn = document.getElementById("takeAnotherSavedBtn");
    const messageStep = document.getElementById("messageStep");
    const qrStep = document.getElementById("qrStep");
    const input = document.getElementById("messageInput");
    const count = document.getElementById("count");
    const generate = document.getElementById("generate");
    const newPhoto = document.getElementById("newPhoto");
    const shareQr = document.getElementById("shareQr");
    const qr = document.getElementById("qr");
    const preview = document.getElementById("messagePreview");

    let stream = null;
    let capturedBlob = null;
    let uploadedPhotoUrl = "";
    let uploadedPhotoId = "";

    loadGallery();
    startCamera();

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        document.getElementById("cameraStatus").textContent =
          "Camera is not available. Use an HTTPS website.";
        capture.disabled = true;
        return;
      }

      capture.disabled = true;
      document.getElementById("cameraStatus").textContent = "Starting camera…";

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 1280 }
          },
          audio: false
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
        document.getElementById("cameraStatus").textContent = "Ready — capture a photo";
        capture.disabled = false;
      } catch (e) {
        console.error("Camera error:", e);
        document.getElementById("cameraStatus").textContent = "Camera permission is required.";
        capture.disabled = true;
      }
    }

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      video.srcObject = null;
    }

    function resetForRetake() {
      capturedBlob = null;
      uploadedPhotoUrl = "";
      uploadedPhotoId = "";
      capturedPreview.removeAttribute("src");
      capturedStep.classList.add("hidden");
      savedPhotoStep.classList.add("hidden");
      messageStep.classList.add("hidden");
      qrStep.classList.add("hidden");
      qr.innerHTML = "";
      input.value = "";
      count.textContent = "0";
      retryUploadBtn.classList.add("hidden");
      continueBtn.classList.add("hidden");
      takeAnotherSavedBtn.classList.add("hidden");
      confirmPhotoBtn.disabled = false;
      retakePhotoBtn.disabled = false;
      capture.disabled = true;
      stopCamera();
      startCamera();
      window.scrollTo({top: 0, behavior: "smooth"});
    }

    capture.onclick = async () => {
      if (!video.videoWidth) return;

      const canvas = document.createElement("canvas");
      const max = 1600;
      const scale = Math.min(1, max / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

      capturedBlob = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/jpeg", 0.88)
      );

      if (!capturedBlob) {
        photoStatus.textContent = "Could not create the photo. Please try again.";
        photoStatus.className = "photo-status error";
        return;
      }

      capturedPreview.src = URL.createObjectURL(capturedBlob);
      capturedStep.classList.remove("hidden");
      photoStatus.textContent = "Is this photo correct? Choose Yes to save it, or Retake to capture another photo.";
      photoStatus.className = "photo-status";
      confirmPhotoBtn.disabled = false;
      retakePhotoBtn.disabled = false;
      capture.disabled = true;
      capturedStep.scrollIntoView({behavior: "smooth"});
    };

    confirmPhotoBtn.onclick = async () => {
      if (!capturedBlob) return;

      confirmPhotoBtn.disabled = true;
      retakePhotoBtn.disabled = true;
      photoStatus.textContent = "Saving the confirmed photo…";
      photoStatus.className = "photo-status";

      try {
        await savePhoto(capturedBlob);
        await loadGallery();
        downloadPhoto(capturedBlob);

        savedPhotoStep.classList.remove("hidden");
        uploadStatus.textContent = "Local backup saved. Uploading the photo to GitHub…";
        savedPhotoStep.scrollIntoView({behavior: "smooth"});

        await uploadConfirmedPhoto();
      } catch (e) {
        console.error("Photo save/upload failed:", e);
        uploadStatus.textContent = "The photo was saved locally, but the GitHub upload failed. You can retry the upload.";
        uploadStatus.className = "photo-status error";
        retryUploadBtn.classList.remove("hidden");
        takeAnotherSavedBtn.classList.remove("hidden");
      }
    };

    async function uploadConfirmedPhoto() {
      retryUploadBtn.classList.add("hidden");
      continueBtn.classList.add("hidden");
      takeAnotherSavedBtn.classList.add("hidden");

      try {
        const result = await uploadPhotoToGitHub(capturedBlob);
        if (!result.ok) throw new Error(result.error || "GitHub upload failed.");

        uploadedPhotoUrl = result.photoUrl;
        uploadedPhotoId = result.id || "";
        uploadStatus.textContent = "Photo saved locally and uploaded to GitHub successfully.";
        uploadStatus.className = "photo-status success";
        continueBtn.classList.remove("hidden");
        takeAnotherSavedBtn.classList.remove("hidden");
        stopCamera();
      } catch (e) {
        console.error("GitHub upload error:", e);
        uploadStatus.textContent = `Local backup saved, but GitHub upload failed: ${e.message}`;
        uploadStatus.className = "photo-status error";
        retryUploadBtn.classList.remove("hidden");
        takeAnotherSavedBtn.classList.remove("hidden");
      }
    }

    retryUploadBtn.onclick = uploadConfirmedPhoto;

    continueBtn.onclick = () => {
      if (!uploadedPhotoUrl) return;
      messageStep.classList.remove("hidden");
      messageStep.scrollIntoView({behavior: "smooth"});
    };

    takeAnotherSavedBtn.onclick = resetForRetake;
    retakePhotoBtn.onclick = resetForRetake;

    input.oninput = () => {
      count.textContent = input.value.length;
    };

    generate.onclick = () => {
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      if (!uploadedPhotoUrl) {
        uploadStatus.textContent = "Please wait for the photo to finish uploading to GitHub before generating the QR code.";
        uploadStatus.className = "photo-status error";
        savedPhotoStep.scrollIntoView({behavior: "smooth"});
        return;
      }

      qr.innerHTML = "";
      const url = buildCustomerUrl(text, uploadedPhotoUrl);

      new QRCode(qr, {
        text: url,
        width: 240,
        height: 240,
        colorDark: "#111827",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });

      preview.textContent = text;
      qrStep.classList.remove("hidden");
      qrStep.scrollIntoView({behavior: "smooth"});
    };

    shareQr.onclick = () => {
      const text = input.value.trim();
      if (text && uploadedPhotoUrl) shareQRCode(text, uploadedPhotoUrl);
    };

    newPhoto.onclick = resetForRetake;

    function photoFileName() {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      return `smile-photo-${stamp}.jpg`;
    }

    function downloadPhoto(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photoFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }

    async function uploadPhotoToGitHub(blob) {
      const response = await fetch("api/upload", {
        method: "POST",
        headers: {"Content-Type": "image/jpeg"},
        body: blob
      });

      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) {
        throw new Error(data.error || `Upload endpoint returned ${response.status}.`);
      }
      return data;
    }

    async function shareQRCode(text, imageUrl) {
      const url = buildCustomerUrl(text, imageUrl);
      const qrCanvas = qr.querySelector("canvas");
      const qrImage = qr.querySelector("img");

      try {
        let blob = null;
        if (qrCanvas) {
          blob = await new Promise(resolve => qrCanvas.toBlob(resolve, "image/png"));
        } else if (qrImage && qrImage.src) {
          const response = await fetch(qrImage.src);
          blob = await response.blob();
        }

        if (blob && navigator.share) {
          const file = new File([blob], "smile-qr-code.png", {type: "image/png"});
          if (!navigator.canShare || navigator.canShare({files: [file]})) {
            await navigator.share({
              title: "Smile QR Code",
              text: "Scan this QR code to view the Smile photo and message.",
              files: [file]
            });
            shareQr.textContent = "QR Code Shared";
            return;
          }
        }

        if (navigator.share) {
          await navigator.share({title: "Smile QR Code", text: "Scan this Smile QR code.", url});
          shareQr.textContent = "QR Link Shared";
          return;
        }

        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          shareQr.textContent = "QR Link Copied";
          return;
        }
        shareQr.textContent = "Share QR Code";
      } catch (e) {
        if (e && e.name === "AbortError") return;
        console.error("QR sharing failed:", e);
        shareQr.textContent = "Share QR Code";
      }
    }

    async function loadGallery() {
      const gallery = document.getElementById("gallery");
      const empty = document.getElementById("empty");
      try {
        const photos = await getPhotos();
        gallery.innerHTML = "";
        if (!photos.length) {
          empty.style.display = "block";
          empty.textContent = "No photos captured yet.";
          return;
        }
        empty.style.display = "none";
        photos.slice().reverse().forEach(p => {
          const img = document.createElement("img");
          img.src = URL.createObjectURL(p.blob);
          img.alt = "Captured photo";
          gallery.appendChild(img);
        });
      } catch (e) {
        console.error("Gallery load failed:", e);
        empty.style.display = "block";
        empty.textContent = "Browser storage is unavailable on this device/browser.";
      }
    }
  }

  function renderCustomer(text, imageUrl) {
    app.innerHTML = `
      <main class="screen customer">
        <div class="customer-logo">SMILE</div>
        <div class="customer-card">
          <div id="customerPhotoWrap" class="customer-photo-wrap hidden">
            <img id="customerPhoto" class="customer-photo" alt="Smile photo">
          </div>
          <div class="emoji">😊</div>
          <div class="customer-label">A message for you</div>
          <div class="customer-message"></div>
          <div class="customer-note">Thank you for visiting!</div>
        </div>
        <button class="primary" id="share">Share Message</button>
      </main>
    `;

    document.querySelector(".customer-message").textContent = text;

    if (imageUrl) {
      const wrap = document.getElementById("customerPhotoWrap");
      const image = document.getElementById("customerPhoto");
      image.src = imageUrl;
      image.onload = () => wrap.classList.remove("hidden");
      image.onerror = () => {
        wrap.classList.add("hidden");
        console.warn("Could not load GitHub photo:", imageUrl);
      };
    }

    document.getElementById("share").onclick = async () => {
      const shareText = text || "Smile";
      const shareUrl = location.href;
      if (navigator.share) {
        try { await navigator.share({title: "Smile", text: shareText, url: shareUrl}); } catch {}
      } else {
        await navigator.clipboard?.writeText(shareUrl);
        document.getElementById("share").textContent = "Link Copied";
      }
    };
  }

  function buildCustomerUrl(text, imageUrl) {
    const base = location.origin + location.pathname;
    return base + "?message=" + encodeURIComponent(text) + "&photo=" + encodeURIComponent(imageUrl);
  }

  const DB_NAME = "smile-local";
  const STORE = "photos";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, {keyPath: "id", autoIncrement: true});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function savePhoto(blob) {
    if (!blob) throw new Error("No photo data to save.");
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({blob, createdAt: Date.now()});
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { const err = tx.error || new Error("Photo storage transaction failed."); db.close(); reject(err); };
      tx.onabort = () => { const err = tx.error || new Error("Photo storage transaction was aborted."); db.close(); reject(err); };
    });
  }

  async function getPhotos() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => { const data = req.result; db.close(); resolve(data); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  }
})();
