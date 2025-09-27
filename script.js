document.addEventListener('DOMContentLoaded', () => {
    console.log("Halaman dimuat, modal seharusnya tersembunyi.");
    // ---- Three.js Background Animation ----
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-animation'), alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const materialColor = new THREE.MeshPhongMaterial({
        color: 0x8A6D5E, // Cokelat tua
        shininess: 50,
        specular: 0x8A6D5E,
    });

    const geometry = new THREE.IcosahedronGeometry(1.5, 0);
    const icosahedron = new THREE.Mesh(geometry, materialColor);
    scene.add(icosahedron);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5).normalize();
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    camera.position.z = 5;

    function animate() {
        requestAnimationFrame(animate);
        icosahedron.rotation.x += 0.005;
        icosahedron.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
    
    // ---- Daily Expense Tracker Logic ----
    const form = document.getElementById('expenseForm');
    const tanggalInput = document.getElementById('tanggal');
    const deskripsiInput = document.getElementById('deskripsi');
    const jumlahInput = document.getElementById('jumlah');
    const expenseList = document.getElementById('expenseList');
    const summaryContent = document.getElementById('summaryContent');
    const messageDiv = document.getElementById('message');
    const apiMessageDiv = document.getElementById('apiMessage');
    const analyzeBtn = document.getElementById('analyzeExpensesBtn');
    const kategoriSelect = document.getElementById('kategori');
    const detectItemsBtn = document.getElementById('detectItemsBtn');
    const detectionModal = document.getElementById('detectionModal');
    const detectedItemsList = document.getElementById('detectedItemsList');
    const confirmItemsBtn = document.getElementById('confirmItemsBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const loader = document.getElementById('loader');
    const chartContainer = document.getElementById('chartContainer');
    const chartCanvas = document.getElementById('expenseChart');
    const syncSection = document.getElementById('syncSection');
    const syncLinkInput = document.getElementById('syncLinkInput');
    const preloader = document.getElementById('preloader');

    // ---- Elemen Navigasi dan Halaman Baru ----
    const navExpenseTracker = document.getElementById('nav-expense-tracker');
    const navDataAnalyzer = document.getElementById('nav-data-analyzer');
    const expenseTrackerPage = document.getElementById('expense-tracker-page');
    const dataAnalyzerPage = document.getElementById('data-analyzer-page');

    // ---- Elemen Halaman Analis Data ----
    const csvFileInput = document.getElementById('csvFileInput');
    const analysisPrompt = document.getElementById('analysisPrompt');
    const runAnalysisBtn = document.getElementById('runAnalysisBtn');
    const analysisResultContainer = document.getElementById('analysisResultContainer');
    const analysisLoader = document.getElementById('analysisLoader');
    const analysisResultTitle = document.getElementById('analysisResultTitle');
    const analysisResultContent = document.getElementById('analysisResultContent');
    const dataSummaryContainer = document.getElementById('dataSummaryContainer');
    const dataSummaryLoader = document.getElementById('dataSummaryLoader');
    const dataSummaryContent = document.getElementById('dataSummaryContent');
    const suggestedAnalysisContainer = document.getElementById('suggestedAnalysisContainer');
    const suggestedAnalysisButtons = document.getElementById('suggestedAnalysisButtons');
    const executePlanBtn = document.getElementById('executePlanBtn');

    let userId = null;
    let detectedItems = [];
    let expenseChartInstance = null; // Untuk menyimpan instance chart
    let parsedCsvData = null; // Untuk menyimpan data CSV yang sudah di-parse

    // --- URL Proxy Aman ke Gemini API ---
    // Ini adalah path ke serverless function kita di Netlify.
    const geminiProxyUrl = "/.netlify/functions/gemini-proxy";
    const FIREBASE_APP_ID = 'default-app-id'; // Konstanta untuk ID aplikasi di Firebase

    // Firebase Initialization and Authentication
    const firebaseConfig = {
      apiKey: "AIzaSyD_33r5f_4M7aX0XuyhRIFGoyPESfjGnUI",
      authDomain: "expenses-a36ff.firebaseapp.com",
      projectId: "expenses-a36ff",
      storageBucket: "expenses-a36ff.firebasestorage.app",
      messagingSenderId: "306521276424",
      appId: "1:306521276424:web:654020afbefbbd4d8311bd",
      measurementId: "G-1NSLPX2568"
    };
    // Anda bisa menyimpan konfigurasi ini di sini dengan aman karena kode JavaScript
    // di sisi klien memang dirancang untuk bisa diakses publik.
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const authInstance = firebase.auth();

    const setupRealtimeDataListener = () => {
        const expensesCollectionRef = db.collection(`artifacts/${FIREBASE_APP_ID}/users/${userId}/expenses`);
        const q = expensesCollectionRef.orderBy('tanggal', 'desc');

        q.onSnapshot((snapshot) => {
            const expenses = [];
            snapshot.forEach((doc) => {
                expenses.push({ id: doc.id, ...doc.data() });
            });
            renderData(expenses);
        }, (error) => {
            console.error("Error fetching documents:", error);
            showMessage("Gagal memuat data pengeluaran.", "error");
        });
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'Makanan': return '🍔';
            case 'Transportasi': return '🚗';
            case 'Belanja': return '🛍️';
            case 'Hiburan': return '🎬';
            case 'Tagihan': return '🧾';
            default: return '💰';
        }
    };

    const renderData = (expenses) => {
        expenseList.innerHTML = '';
        summaryContent.innerHTML = '';

        const dailySummary = {};
        if (expenses.length === 0) {
            expenseList.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid var(--glass-border);">
                    <p style="font-size: 2.5rem; margin-bottom: 0.5rem;">📝</p>
                    <p style="font-weight: 600; font-size: 1.1rem;">Belum Ada Pengeluaran</p>
                    <p style="font-size: 0.9em; color: var(--primary-hover);">Coba tambahkan transaksi pertamamu untuk memulai!</p>
                </div>`;
            summaryContent.innerHTML = '<p style="text-align: center; color: var(--primary-hover);">Ringkasan akan muncul di sini.</p>';
            // Sembunyikan chart jika tidak ada data
            chartContainer.classList.add('hidden');
            if (expenseChartInstance) {
                expenseChartInstance.destroy();
                expenseChartInstance = null;
            }
            return;
        }

        expenses.forEach(expense => {
            const expenseItem = document.createElement('div');
            expenseItem.className = 'expense-item';
            
            const expenseDate = expense.tanggal?.toDate ? expense.tanggal.toDate() : new Date(expense.tanggal);
            const formattedDate = expenseDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

            expenseItem.innerHTML = `
                <div class="expense-icon">${getCategoryIcon(expense.kategori)}</div>
                <div class="expense-details">
                    <p class="font-bold">${expense.deskripsi}</p>
                    <p class="text-sm">${expense.kategori || 'Lain-lain'} &bull; ${formattedDate}</p>
                    ${expense.tempat ? `<p class="text-sm" style="font-size: 0.8em; color: var(--primary-hover); margin-top: 4px;">📍 ${expense.tempat}</p>` : ''}
                    ${expense.metodePembayaran ? `<p class="text-sm" style="font-size: 0.8em; color: var(--primary-hover); margin-top: 2px;">💳 ${expense.metodePembayaran}</p>` : ''}
                </div>
                <div class="expense-actions">
                    <span class="amount text-lg">Rp${formatRupiah(expense.jumlah)}</span>
                    <button class="delete-btn" data-id="${expense.id}">×</button>
                </div>
            `;
            expenseList.appendChild(expenseItem);

            const dateKey = formattedDate;
            if (!dailySummary[dateKey]) {
                dailySummary[dateKey] = 0;
            }
            dailySummary[dateKey] += expense.jumlah;
        });

        for (const [date, total] of Object.entries(dailySummary)) {
            const summaryItem = document.createElement('p');
            summaryItem.innerHTML = `Pengeluaran ${date}: <span class="font-bold">Rp${formatRupiah(total)}</span>`;
            summaryContent.appendChild(summaryItem);
        }
    };

    const formatRupiah = (number) => {
        return new Intl.NumberFormat('id-ID').format(number);
    };

    const showMessage = (text, type) => {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    };

    const showApiMessage = (text, type) => {
        apiMessageDiv.textContent = text;
        apiMessageDiv.className = `message ${type}`;
        apiMessageDiv.style.display = 'block';
    };

    const hideApiMessage = () => {
        apiMessageDiv.style.display = 'none';
    };

    // Fungsi baru untuk mengontrol loader
    const showLoader = () => {
        if (loader) loader.classList.remove('hidden');
    };

    const hideLoader = () => {
        if (loader) loader.classList.add('hidden');
    };

    // Event listener untuk menghapus item
    expenseList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            const userConfirmed = confirm("Apakah Anda yakin ingin menghapus pengeluaran ini?");
    
            if (userConfirmed) {
                try {
                    const docRef = db.collection(`artifacts/${FIREBASE_APP_ID}/users/${userId}/expenses`).doc(id);
                    await docRef.delete();
                    // Tidak perlu panggil showMessage, karena onSnapshot akan otomatis update UI
                    // dan menghapus item, yang sudah merupakan feedback visual yang cukup.
                } catch (error) {
                    console.error("Gagal menghapus dokumen:", error);
                    showMessage("Gagal menghapus pengeluaran.", "error");
                }
            }
        }
    });

    // ---- Gemini API Helper Function ----
    /**
     * Memanggil Gemini API melalui proxy serverless dengan penanganan error terpusat.
     * @param {string} prompt - Prompt yang akan dikirim ke AI.
     * @returns {Promise<string>} - Teks respons dari AI.
     * @throws {Error} - Melemparkan error jika panggilan API gagal.
     */
    const callGeminiAPI = async (prompt) => {
        // --- LOGIKA BARU: Panggilan Langsung ke Google API ---
        const geminiApiKey = firebaseConfig.apiKey; // Ambil dari konfigurasi Firebase
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
        };
        // --- AKHIR LOGIKA BARU ---

        const maxRetries = 3;
        const delay = 2000; // 2 detik
    
        for (let i = 0; i < maxRetries; i++) {
            const response = await fetch(apiUrl, { // Gunakan apiUrl langsung
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Gunakan payload yang sudah dibuat
            });
    
            // Jika sukses, langsung kembalikan hasil
            if (response.ok) {
                const result = await response.json();
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) {
                    if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
                        throw new Error("Respons diblokir karena alasan keamanan. Coba dengan deskripsi yang berbeda.");
                    }
                    throw new Error("Gagal mendapatkan konten teks dari respons AI.");
                }
                return text;
            }
    
            // Jika error bisa di-retry (server sibuk atau kuota habis)
            if (response.status === 429 || response.status === 503) {
                if (i === maxRetries - 1) { // Jika ini percobaan terakhir
                    const errorMsg = response.status === 429 
                        ? "Anda telah mencapai batas penggunaan API. Silakan coba lagi nanti."
                        : "Server AI sedang sibuk. Silakan coba lagi nanti.";
                    throw new Error(errorMsg);
                }
                console.log(`Server sibuk (status ${response.status}), mencoba lagi dalam ${delay / 1000} detik...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else { // Untuk error lain yang tidak bisa di-retry
                let errorBody = `Status: ${response.status}`;
                try { 
                    const errorJson = await response.json(); 
                    errorBody += ` - Pesan: ${errorJson.error?.message || JSON.stringify(errorJson)}`; 
                } catch (e) { 
                    // Jika body bukan JSON, tambahkan teks respons mentah jika ada
                    errorBody += ` - Respons: ${await response.text()}`;
                }
                throw new Error(`Server AI merespons dengan error: ${errorBody}`);
            }
        }
        throw new Error("Gagal menghubungi server AI setelah beberapa kali percobaan.");
    };
    
    // Logika untuk menyimpan pengeluaran tunggal
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newExpense = {
            tanggal: new Date(tanggalInput.value),
            deskripsi: deskripsiInput.value.trim(),
            jumlah: parseFloat(jumlahInput.value),
            kategori: kategoriSelect.value || 'Tidak ada kategori'
        };

        try {
            const expensesCollectionRef = db.collection(`artifacts/${FIREBASE_APP_ID}/users/${userId}/expenses`);
            await expensesCollectionRef.add(newExpense);
            showMessage("Pengeluaran berhasil disimpan!", "success");
            form.reset();
            tanggalInput.valueAsDate = new Date();
        } catch (error) {
            console.error("Gagal menyimpan data ke Firebase:", error);
            showMessage("Gagal menyimpan data.", "error");
        }
    });

    // --- FUNGSI BARU: Menganalisis dan Menampilkan Chart ---
    analyzeBtn.addEventListener('click', async () => {
        if (!userId) {
            showMessage("Mohon tunggu, autentikasi sedang berlangsung...", "error");
            return;
        }

        showLoader();
        hideApiMessage();

        const expensesCollectionRef = db.collection(`artifacts/${FIREBASE_APP_ID}/users/${userId}/expenses`);

        try {
            const snapshot = await expensesCollectionRef.get();
            if (snapshot.empty) {
                showMessage("Tidak ada data pengeluaran untuk dianalisis.", "error");
                chartContainer.classList.add('hidden'); // Sembunyikan jika tidak ada data
                return;
            }

            const categoryTotals = {};
            snapshot.forEach(doc => {
                const expense = doc.data();
                const category = expense.kategori || 'Lain-lain';
                if (!categoryTotals[category]) {
                    categoryTotals[category] = 0;
                }
                categoryTotals[category] += expense.jumlah;
            });

            const labels = Object.keys(categoryTotals);
            const data = Object.values(categoryTotals);

            // Hancurkan chart lama jika ada, untuk mencegah bug rendering
            if (expenseChartInstance) {
                expenseChartInstance.destroy();
            }

            chartContainer.classList.remove('hidden');

            expenseChartInstance = new Chart(chartCanvas, {
                type: 'doughnut', // Tipe chart: doughnut, pie, bar, etc.
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Pengeluaran per Kategori',
                        data: data,
                        backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#C9CBCF'],
                        hoverOffset: 4
                    }]
                }
            });
        } catch (error) {
            showMessage("Gagal mengambil data untuk analisis.", "error");
            console.error("Error generating chart:", error);
        } finally {
            hideLoader();
        }
    });

    // Logika baru untuk mendeteksi item dari deskripsi
    detectItemsBtn.addEventListener('click', async () => {
        console.log("Tombol 'Deteksi Item' diklik. Memulai proses...");
        const description = deskripsiInput.value.trim();
        if (!description) {
            showApiMessage("Masukkan deskripsi pengeluaran terlebih dahulu.", "error");
            return;
        }
        
        hideApiMessage();
        showLoader();
        
        const prompt = `Ekstrak setiap item, harga, kategori, tempat pembelian, dan metode pembayaran dari teks berikut: "${description}". Kategorikan setiap item ke dalam: Makanan, Transportasi, Belanja, Hiburan, Tagihan, atau Lain-lain. Jika harga, tempat, atau metode pembayaran tidak disebutkan, gunakan nilai null atau string kosong. Kembalikan hasilnya sebagai array JSON yang valid. Contoh input "saya tadi beli rokok di warung madua kisma seharga 2500 bayarnya pakai qris mandiri" harus menghasilkan [{"item": "rokok", "harga": 2500, "kategori": "Belanja", "tempat": "warung madua kisma", "metodePembayaran": "qris mandiri"}]. Jangan sertakan teks atau penjelasan lain, hanya array JSON.`;

        try {
            let jsonString = await callGeminiAPI(prompt);

            // Membersihkan string dari markdown code block yang mungkin ditambahkan oleh AI
            jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Mem-parsing string yang sudah bersih menjadi objek JSON
            detectedItems = JSON.parse(jsonString);

            if (Array.isArray(detectedItems) && detectedItems.length > 0) {
                renderDetectedItems(detectedItems);
                detectionModal.classList.remove('hidden');
            } else {
                showApiMessage("Tidak ada item yang dapat dideteksi dari deskripsi.", "error");
            }
        } catch (error) {
            showApiMessage("Terjadi kesalahan saat mendeteksi item. Cek console untuk detail.", "error");
            console.error("Error during item detection:", error.message);
        } finally {
            hideLoader();
        }
    });

    const renderDetectedItems = (items) => {
        detectedItemsList.innerHTML = '';
        let totalAmount = 0;
        
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'mb-3'; // Simple spacing for items in modal
            itemDiv.innerHTML = `
                <p class="font-bold">${item.item} (${item.kategori || 'Lain-lain'})</p>
                <p class="text-sm">Rp${formatRupiah(item.harga || 0)}</p>
                ${item.tempat ? `<p class="text-sm" style="color: #4A3E39; opacity: 0.8;">di ${item.tempat}</p>` : ''}
                ${item.metodePembayaran ? `<p class="text-sm" style="color: #4A3E39; opacity: 0.8;">via ${item.metodePembayaran}</p>` : ''}
            `;
            detectedItemsList.appendChild(itemDiv);
            totalAmount += item.harga;
        });

        const totalDiv = document.createElement('div');
        totalDiv.className = 'mt-4 font-bold text-center';
        totalDiv.innerHTML = `Total Pengeluaran: Rp${formatRupiah(totalAmount)}`;
        detectedItemsList.appendChild(totalDiv);
    };

    confirmItemsBtn.addEventListener('click', async () => {
        if (detectedItems.length === 0) return;
        
        // Validasi: Pastikan tanggal sudah diisi sebelum menyimpan
        if (!tanggalInput.value) {
            detectionModal.classList.add('hidden');
            showMessage("Tanggal harus diisi sebelum menyimpan transaksi.", "error");
            return;
        }

        const tanggal = new Date(tanggalInput.value);
        const expensesCollectionRef = db.collection(`artifacts/${FIREBASE_APP_ID}/users/${userId}/expenses`);
        
        detectionModal.classList.add('hidden');
        showApiMessage("Menyimpan semua transaksi...", "success");

        try {
            for (const item of detectedItems) {
                const newExpense = {
                    tanggal: tanggal,
                    deskripsi: item.item,
                    jumlah: item.harga || 0,
                    kategori: item.kategori || 'Lain-lain',
                    tempat: item.tempat || null,
                    metodePembayaran: item.metodePembayaran || null
                };
                await expensesCollectionRef.add(newExpense);
            }
            // Gunakan showMessage agar notifikasi bisa hilang otomatis dan konsisten
            showMessage("Semua transaksi berhasil disimpan!", "success");
            hideApiMessage(); // Sembunyikan pesan "Menyimpan..." yang sedang tampil
            form.reset();
            tanggalInput.valueAsDate = new Date();
            detectedItems = [];
        } catch (error) {
            showApiMessage("Gagal menyimpan beberapa transaksi.", "error");
            console.error("Error saving multiple docs:", error);
        }
    });

    cancelModalBtn.addEventListener('click', () => {
        detectionModal.classList.add('hidden');
        detectedItems = [];
        hideApiMessage();
    });

    // --- LOGIKA SINKRONISASI BARU DENGAN LOCALSTORAGE ---
    showApiMessage("Menghubungkan ke server...", "success"); // Tampilkan pesan awal

    const savedUid = localStorage.getItem('expenseTrackerUid');
    const urlParams = new URLSearchParams(window.location.search);
    const uidFromUrl = urlParams.get('uid');

    // Pindahkan logika copy dari inline HTML ke sini
    syncLinkInput.addEventListener('click', function() {
        this.select();
        // Coba metode modern terlebih dahulu
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(this.value).then(() => {
                alert('Link disalin ke clipboard!');
            });
        } else {
            // Fallback untuk browser lama
            document.execCommand('copy');
            alert('Link disalin ke clipboard!');
        }
    });
    // Fungsi untuk membuat QR Code (diambil dari langkah sebelumnya)
    const generateQRCode = (url) => {
        const qrCodeCanvas = document.getElementById('qrCodeCanvas');
        if (qrCodeCanvas && typeof QRious !== 'undefined') {
            new QRious({
                element: qrCodeCanvas,
                value: url,
                size: 180,
                padding: 10,
            });
        }
    };

    const hidePreloader = () => {
        if (preloader) {
            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden';
        }
    };

    const initializeAppWithUser = (uid) => {
        userId = uid;
        // Simpan UID ke localStorage agar diingat saat PWA dibuka
        localStorage.setItem('expenseTrackerUid', uid);
        
        hideApiMessage();
        hidePreloader(); // Sembunyikan preloader saat aplikasi siap
        setupRealtimeDataListener();
        
        // Perbarui dan tampilkan UI sinkronisasi
        const syncUrl = `${window.location.origin}${window.location.pathname}?uid=${userId}`;
        syncLinkInput.value = syncUrl;
        generateQRCode(syncUrl);
        syncSection.classList.remove('hidden');
    };

    if (uidFromUrl) {
        // Prioritas 1: Jika ada UID di URL (dari QR scan/link), gunakan dan simpan.
        console.log("UID dari URL ditemukan, menyimpan ke localStorage:", uidFromUrl);
        initializeAppWithUser(uidFromUrl);
    } else if (savedUid) {
        // Prioritas 2: Gunakan UID dari localStorage jika tidak ada dari URL.
        console.log("UID dari localStorage ditemukan:", savedUid);
        initializeAppWithUser(savedUid);
    } else {
        // Prioritas 3: Buat pengguna anonim baru jika tidak ada sama sekali.
        console.log("Tidak ada UID di URL, melakukan sign-in anonim...");
        authInstance.signInAnonymously()
            .then(userCredential => {
                if (userCredential.user) {
                    console.log("Berhasil login anonim, UID baru:", userCredential.user.uid);
                    initializeAppWithUser(userCredential.user.uid);
                }
            })
            .catch((error) => {
                console.error("Gagal melakukan autentikasi anonim:", error);
                showApiMessage("Gagal terhubung. Pastikan metode 'Anonymous' aktif di Firebase.", "error");
            });
    }

    // ---- LOGIKA UNTUK NAVIGASI ANTAR HALAMAN ----
    navExpenseTracker.addEventListener('click', (e) => {
        e.preventDefault();
        expenseTrackerPage.classList.remove('hidden');
        dataAnalyzerPage.classList.add('hidden');
        navExpenseTracker.classList.add('active');
        navDataAnalyzer.classList.remove('active');
    });

    navDataAnalyzer.addEventListener('click', (e) => {
        e.preventDefault();
        expenseTrackerPage.classList.add('hidden');
        dataAnalyzerPage.classList.remove('hidden');
        navExpenseTracker.classList.remove('active');
        navDataAnalyzer.classList.add('active');
    });

    // ---- LOGIKA UNTUK ASISTEN ANALIS DATA ----

    // Langkah 1: Saat file diunggah, buat ringkasan data otomatis
    csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            dataSummaryContainer.classList.add('hidden');
            suggestedAnalysisContainer.classList.add('hidden');
            parsedCsvData = null;
            return;
        }

        dataSummaryContainer.classList.remove('hidden');
        dataSummaryLoader.classList.remove('hidden');
        dataSummaryContent.textContent = '';
        suggestedAnalysisContainer.classList.add('hidden'); // Sembunyikan saran saat loading

        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            complete: async (results) => {
                parsedCsvData = results.data;
                if (parsedCsvData.length > 0 && Object.values(parsedCsvData[parsedCsvData.length - 1]).every(v => v === null || v === '')) {
                    parsedCsvData.pop();
                }

                const headers = results.meta.fields;
                const sampleData = parsedCsvData.slice(0, 5);
                const rowCount = parsedCsvData.length;

                const summaryPrompt = `
Anda adalah asisten analis data. Diberikan metadata dari sebuah file CSV.
Tugas Anda adalah memberikan ringkasan singkat tentang data tersebut.

Informasi Data:
- Jumlah baris data: ${rowCount}
- Nama-nama kolom: ${headers.join(', ')}

Berikan ringkasan yang mencakup:
1. Konfirmasi jumlah baris dan kolom.
2. Daftar nama kolom.
3. Tebakan tipe data untuk setiap kolom (misal: Numerik, Teks, Tanggal) berdasarkan namanya.
4. Satu paragraf singkat yang menjelaskan kemungkinan isi dari dataset ini berdasarkan nama-nama kolomnya.

Gunakan format **Markdown** yang jelas dan modern. Gunakan heading (contoh: '### Ringkasan'), list, dan tebalkan (bold) bagian-bagian penting. Buat tabel untuk daftar kolom dan tebakan tipe datanya. Mulai jawaban Anda langsung dengan ringkasan, tanpa basa-basi.`;

                try {
                    const summaryText = await callGeminiAPI(summaryPrompt);
                    if (typeof marked !== 'undefined') {
                        dataSummaryContent.innerHTML = marked.parse(summaryText);
                    } else {
                        dataSummaryContent.textContent = summaryText; // Fallback jika marked.js gagal dimuat
                    }
                    // Tampilkan tombol saran setelah ringkasan berhasil dimuat
                    renderSuggestionButtons(results.meta.fields);
                    suggestedAnalysisContainer.classList.remove('hidden');
                } catch (error) {
                    // Menampilkan pesan error yang lebih spesifik
                    dataSummaryContent.innerHTML = `<p class="message error">Gagal memuat ringkasan: ${error.message}</p>`;
                    console.error("Error getting data summary:", error);
                } finally {
                    dataSummaryLoader.classList.add('hidden');
                }
            },
            error: (error) => {
                dataSummaryContent.textContent = `Gagal mem-parsing file CSV: ${error.message}`;
                dataSummaryLoader.classList.add('hidden');
                console.error("PapaParse Error:", error);
                parsedCsvData = null;
            }
        });
    });

    // Fungsi baru untuk membuat tombol saran analisis
    const renderSuggestionButtons = (columns) => {
        suggestedAnalysisButtons.innerHTML = ''; // Kosongkan tombol lama
        const columnString = columns.join(', ');

        const suggestions = [
            { name: 'Statistik Deskriptif', prompt: `Berikan analisis statistik deskriptif lengkap untuk semua kolom numerik dalam data. Sertakan mean, median, standar deviasi, min, dan max untuk setiap kolom. Tampilkan hasilnya dalam format tabel Markdown.` },
            { name: 'Analisis Korelasi', prompt: `Hitung dan tampilkan matriks korelasi untuk semua variabel numerik dalam data. Berikan interpretasi singkat tentang korelasi terkuat (positif dan negatif) yang Anda temukan.` },
            { name: 'Regresi Linear', prompt: `Lakukan analisis regresi linear untuk mengidentifikasi hubungan antar variabel. Pilih satu variabel dependen yang paling masuk akal dan beberapa variabel independen dari kolom berikut: ${columnString}. Jelaskan modelnya, interpretasikan koefisien, dan berikan nilai R-squared.` },
            { name: 'Identifikasi Outlier', prompt: `Analisis data untuk mengidentifikasi kemungkinan adanya outlier atau anomali di setiap kolom numerik. Jelaskan metode yang Anda gunakan (misalnya, Z-score atau Interquartile Range) dan sebutkan baris data mana yang berpotensi menjadi outlier.` },
            { name: 'Analisis Time Series', prompt: `Jika ada kolom yang berhubungan dengan waktu, lakukan analisis time series dasar. Identifikasi tren dan musiman jika ada. Kolom yang tersedia: ${columnString}.` },
        ];

        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'btn-suggestion';
            btn.textContent = suggestion.name;
            btn.addEventListener('click', () => {
                analysisPrompt.value = suggestion.prompt;
                analysisPrompt.focus(); // Pindahkan fokus ke textarea
                analysisPrompt.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            suggestedAnalysisButtons.appendChild(btn);
        });
    };

    // ---- Helper Functions for Local Statistics Calculation ----
    const getColumn = (data, columnName) => data.map(row => row[columnName]).filter(val => typeof val === 'number' && !isNaN(val));

    const calculateMean = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const calculateStdDev = (arr) => {
        if (arr.length === 0) return 0;
        const mean = calculateMean(arr);
        const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
        return Math.sqrt(variance);
    };

    const calculateMedian = (arr) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    // Variabel global untuk menyimpan rencana analisis dari AI
    let analysisPlan = null;

    // Langkah 2: Jalankan analisis mendalam berdasarkan prompt pengguna
    runAnalysisBtn.addEventListener('click', async () => {
        const userPrompt = analysisPrompt.value.trim();

        if (!parsedCsvData || parsedCsvData.length === 0) {
            alert("Silakan unggah file .csv yang valid terlebih dahulu.");
            return;
        }
        if (!userPrompt) {
            alert("Silakan tulis perintah analisis yang Anda inginkan.");
            return;
        }

        analysisResultContainer.classList.remove('hidden');
        analysisLoader.classList.remove('hidden');
        analysisResultContent.innerHTML = '';
        executePlanBtn.classList.add('hidden');
        analysisResultTitle.textContent = "Membuat Rencana Analisis...";

        const planPrompt = `
Anda adalah seorang perencana analisis data. Diberikan nama-nama kolom dari sebuah dataset dan permintaan dari pengguna.
Tugas Anda adalah membuat rencana analisis dan menentukan statistik apa yang perlu dihitung dari dataset LENGKAP untuk menjalankan rencana tersebut.

Nama Kolom: ${Object.keys(parsedCsvData[0] || {}).join(', ')}
Permintaan Pengguna: "${userPrompt}"

Buatlah respons dalam format JSON yang valid, dengan dua kunci utama:
1. "plan": String yang berisi rencana analisis langkah-demi-langkah dalam format Markdown. Jelaskan apa yang akan Anda analisis dan mengapa.
2. "required_stats": Sebuah array dari objek, di mana setiap objek mendefinisikan satu statistik yang Anda butuhkan. Gunakan format {"column": "nama_kolom", "metric": "jenis_metrik"}.
   Metrik yang valid adalah: 'mean', 'median', 'stddev' (standar deviasi), 'sum', 'count', 'min', 'max'.

Contoh respons JSON:
{
  "plan": "### Rencana Analisis Korelasi\\n1. Saya akan menghitung korelasi antara 'penjualan' dan 'iklan'.\\n2. Saya akan menginterpretasikan hasilnya untuk melihat kekuatan hubungan.",
  "required_stats": [
    {"column": "penjualan", "metric": "mean"},
    {"column": "iklan", "metric": "mean"}
  ]
}

Hanya kembalikan objek JSON, tanpa teks atau penjelasan lain.`;

        try {
            const jsonString = await callGeminiAPI(planPrompt);
            const cleanedJsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            analysisPlan = JSON.parse(cleanedJsonString);

            if (analysisPlan.plan && analysisPlan.required_stats) {
                analysisResultTitle.textContent = "Rencana Analisis Dibuat";
                analysisResultContent.innerHTML = marked.parse(analysisPlan.plan);
                executePlanBtn.classList.remove('hidden');
                analysisResultContainer.scrollIntoView({ behavior: 'smooth' });
            } else {
                throw new Error("Respons AI tidak memiliki format JSON yang diharapkan (kurang 'plan' atau 'required_stats').");
            }
        } catch (error) {
            analysisResultContent.innerHTML = `<p class="message error">Gagal membuat rencana analisis: ${error.message}</p>`;
            console.error("Error generating analysis plan:", error);
        } finally {
            analysisLoader.classList.add('hidden');
        }
    });

    executePlanBtn.addEventListener('click', async () => {
        if (!analysisPlan || !parsedCsvData) {
            alert("Rencana analisis tidak ditemukan atau data tidak ada.");
            return;
        }

        analysisLoader.classList.remove('hidden');
        executePlanBtn.classList.add('hidden');
        analysisResultTitle.textContent = "Menjalankan Analisis Akhir...";

        try {
            // Step 1: Calculate stats locally from the FULL dataset
            const calculatedStats = {};
            for (const stat of analysisPlan.required_stats) {
                const { column, metric } = stat;
                const key = `${metric}_of_${column}`;
                const columnData = getColumn(parsedCsvData, column);

                if (columnData.length === 0 && metric !== 'count') {
                    calculatedStats[key] = 'N/A (kolom bukan numerik atau kosong)';
                    continue;
                }

                switch (metric) {
                    case 'mean':
                        calculatedStats[key] = calculateMean(columnData);
                        break;
                    case 'median':
                        calculatedStats[key] = calculateMedian(columnData);
                        break;
                    case 'stddev':
                        calculatedStats[key] = calculateStdDev(columnData);
                        break;
                    case 'sum':
                        calculatedStats[key] = columnData.reduce((a, b) => a + b, 0);
                        break;
                    case 'count':
                        // 'count' bisa merujuk ke total baris, bukan hanya numerik
                        calculatedStats[key] = parsedCsvData.length;
                        break;
                    case 'min':
                        calculatedStats[key] = Math.min(...columnData);
                        break;
                    case 'max':
                        calculatedStats[key] = Math.max(...columnData);
                        break;
                    default:
                        calculatedStats[key] = `Metrik tidak dikenal: ${metric}`;
                }
            }

            // Step 2: Build final prompt with the calculated stats
            const finalPrompt = `
Anda adalah seorang analis data ahli yang akan menulis laporan akhir.
Saya telah melakukan pra-perhitungan statistik dari dataset LENGKAP berdasarkan rencana Anda.

Permintaan Asli Pengguna:
"${analysisPrompt.value.trim()}"

Rencana Analisis Anda:
${analysisPlan.plan}

Statistik yang Dihitung dari Dataset Lengkap:
${JSON.stringify(calculatedStats, null, 2)}

Tugas Anda:
Gunakan SEMUA informasi di atas untuk menulis laporan analisis akhir yang komprehensif.
Jawab permintaan pengguna secara langsung, gunakan rencana Anda sebagai panduan, dan dukung kesimpulan Anda dengan statistik yang telah dihitung.
Format jawaban Anda dalam Markdown yang rapi dan profesional.`;

            // Step 3: Call AI and render the final report
            const finalText = await callGeminiAPI(finalPrompt);
            analysisResultTitle.textContent = "Laporan Analisis Akhir";
            analysisResultContent.innerHTML = marked.parse(finalText);
            analysisResultContainer.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            analysisResultContent.innerHTML = `<p class="message error">Gagal mengeksekusi rencana: ${error.message}</p>`;
            console.error("Error executing plan:", error);
        } finally {
            analysisLoader.classList.add('hidden');
        }
    });
});
