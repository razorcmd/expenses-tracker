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
    const suggestBtn = document.getElementById('suggestCategoryBtn');
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
    const analysisResultContent = document.getElementById('analysisResultContent');
    const dataSummaryContainer = document.getElementById('dataSummaryContainer');
    const dataSummaryLoader = document.getElementById('dataSummaryLoader');
    const dataSummaryContent = document.getElementById('dataSummaryContent');
    const suggestedAnalysisContainer = document.getElementById('suggestedAnalysisContainer');
    const suggestedAnalysisButtons = document.getElementById('suggestedAnalysisButtons');

    // ---- Elemen Halaman Panduan Analisis ----
    const analysisGuidePage = document.getElementById('analysis-guide-page');
    const backToAnalyzerBtn = document.getElementById('backToAnalyzerBtn');
    const guideTitle = document.getElementById('guideTitle');
    const guideLoader = document.getElementById('guideLoader');
    const guideContent = document.getElementById('guideContent');

    let userId = null;
    let detectedItems = [];
    let expenseChartInstance = null; // Untuk menyimpan instance chart
    let parsedCsvData = null; // Untuk menyimpan data CSV yang sudah di-parse

    // --- URL Proxy Aman ke Gemini API ---
    // Ini adalah path ke serverless function kita di Netlify.
    const geminiProxyUrl = "/.netlify/functions/gemini-proxy";

    // Firebase Initialization and Authentication
    const firebaseConfig = JSON.parse(__firebase_config);
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const authInstance = firebase.auth();

    const setupRealtimeDataListener = () => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const expensesCollectionRef = db.collection(`artifacts/${appId}/users/${userId}/expenses`);
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
                    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                    const docRef = db.collection(`artifacts/${appId}/users/${userId}/expenses`).doc(id);
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

    // ---- Gemini API Integrations ----
    
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
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const expensesCollectionRef = db.collection(`artifacts/${appId}/users/${userId}/expenses`);
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

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const expensesCollectionRef = db.collection(`artifacts/${appId}/users/${userId}/expenses`);

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

    // Logika untuk menyarankan kategori dengan Gemini API
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            const description = deskripsiInput.value.trim();
            if (!description) {
                showApiMessage("Masukkan deskripsi pengeluaran terlebih dahulu.", "error");
                return;
            }

            hideApiMessage();
            showLoader();

            const prompt = `Berikan satu kata kategori untuk deskripsi pengeluaran berikut: "${description}". Pilih dari kategori yang sudah umum seperti: Makanan, Transportasi, Belanja, Hiburan, Tagihan, Lain-lain. Berikan hanya nama kategori, tanpa penjelasan.`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "text/plain",
                },
            };

            try {
                const response = await fetch(geminiProxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                const result = await response.json();
                const category = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Tidak diketahui";
                
                if (kategoriSelect) {
                    for (let i = 0; i < kategoriSelect.options.length; i++) {
                        if (kategoriSelect.options[i].value.toLowerCase() === category.toLowerCase()) {
                            kategoriSelect.value = kategoriSelect.options[i].value;
                            break;
                        }
                    }
                }
                showApiMessage(`Kategori yang disarankan: ${category}`, "success");
            } catch (error) {
                showApiMessage("Terjadi kesalahan saat menyarankan kategori.", "error");
                console.error(error);
            } finally {
                hideLoader();
            }
        });
    }

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

        let result; // Definisikan di luar try-catch untuk logging
        try {
            const response = await fetch(geminiProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            result = await response.json();
            
            // --- LOGGING UNTUK DEBUG ---
            console.log("Raw API Response:", result);

            // Kembali ke metode parsing teks yang lebih andal
            let jsonString = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!jsonString) {
                if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
                     throw new Error("Respons diblokir karena alasan keamanan. Coba dengan deskripsi yang berbeda.");
                }
                if (result.promptFeedback) {
                    console.error("Prompt Feedback:", result.promptFeedback);
                }
                throw new Error("Gagal mendapatkan respons teks dari API.");
            }

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
            console.error("Error during item detection:", error);
            // Log respons mentah jika tersedia, ini sangat membantu debug
            if (result) {
                console.error("Raw API response that caused the error:", result);
            }
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
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const expensesCollectionRef = db.collection(`artifacts/${appId}/users/${userId}/expenses`);
        
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
Anda adalah asisten analis data. Diberikan metadata dan beberapa baris sampel dari sebuah file CSV.
Tugas Anda adalah memberikan ringkasan singkat tentang data tersebut.

Informasi Data:
- Jumlah baris data: ${rowCount}
- Nama-nama kolom: ${headers.join(', ')}
- 5 baris pertama sebagai sampel:
${JSON.stringify(sampleData, null, 2)}

Berikan ringkasan yang mencakup:
1. Konfirmasi jumlah baris dan kolom.
2. Daftar nama kolom.
3. Tebakan tipe data untuk setiap kolom (misal: Numerik, Teks, Tanggal).
4. Satu paragraf singkat yang menjelaskan kemungkinan isi dari dataset ini.

Gunakan format **Markdown** yang jelas dan modern. Gunakan heading (contoh: '### Ringkasan'), list, dan tebalkan (bold) bagian-bagian penting. Jika memungkinkan, buat tabel untuk daftar kolom dan tipe datanya. Mulai jawaban Anda langsung dengan ringkasan, tanpa basa-basi.`;

                try {
                    const response = await fetch(geminiProxyUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: summaryPrompt })
                    });
                    const result = await response.json();
                    const summaryText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, gagal mendapatkan ringkasan data. Coba lagi.";                    
                    if (typeof marked !== 'undefined') {
                        dataSummaryContent.innerHTML = marked.parse(summaryText);
                    } else {
                        dataSummaryContent.textContent = summaryText; // Fallback jika marked.js gagal dimuat
                    }

                    // Tampilkan tombol saran setelah ringkasan berhasil dimuat
                    renderSuggestionButtons(results.meta.fields);
                    suggestedAnalysisContainer.classList.remove('hidden');
                } catch (error) {
                    // Tangkap error dari fetch atau parsing JSON
                    let errorMessage = "Terjadi kesalahan saat menghubungi server AI untuk ringkasan. Silakan coba lagi nanti.";
                    if (error.message) {
                        errorMessage = `Terjadi kesalahan: ${error.message}`;
                    }
                    dataSummaryContent.textContent = errorMessage;
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

        const analysisCategories = [
            { name: 'Analisis Dasar', methods: ['Statistik Deskriptif', 'Analisis Korelasi'] },
            { name: 'Model Regresi', methods: ['Regresi Linear (OLS)', 'Generalized Linear Models (GLM)', 'Lasso', 'Choice Models (Logit/Probit)'] },
            { name: 'Time Series', methods: ['ARIMA', 'ARCH/GARCH', 'VAR', 'VEC'] },
            { name: 'Uji Perbandingan Grup', methods: ['ANOVA', 'MANOVA'] },
            { name: 'Pendekatan Lain', methods: ['Analisis Bayesian', 'Survival Analysis', 'Panel Data'] }
        ];

        analysisCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'btn-suggestion';
            btn.textContent = category.name;
            btn.addEventListener('click', () => {
                showAnalysisGuide(category.name, category.methods);
            });
            suggestedAnalysisButtons.appendChild(btn);
        });
    };

    // Fungsi baru untuk menampilkan halaman panduan analisis
    const showAnalysisGuide = async (categoryName, methods) => {
        dataAnalyzerPage.classList.add('hidden');
        analysisGuidePage.classList.remove('hidden');

        guideTitle.textContent = `Panduan: ${categoryName}`;
        guideContent.innerHTML = '';
        guideLoader.classList.remove('hidden');

        const guidePrompt = `
Anda adalah seorang profesor statistika dan ekonometrika yang sangat ahli.
Jelaskan metode-metode berikut dalam kategori "${categoryName}".
Metode yang harus dijelaskan: ${methods.join(', ')}.

Untuk setiap metode, berikan penjelasan yang terstruktur dengan format Markdown:
1.  **Judul Metode**: Gunakan heading level 4 (#### Nama Metode).
2.  **Tentang Metode**: Jelaskan secara singkat apa itu metode tersebut dalam 1-2 kalimat.
3.  **Tujuan & Fungsi**: Jelaskan kapan dan untuk apa metode ini digunakan.
4.  **Kebutuhan Data**: Jelaskan jenis data yang diperlukan (misalnya, data time series, data cross-section, variabel dependen harus kontinu, dll.). Berikan contoh sederhana format data yang dibutuhkan dalam bentuk tabel Markdown.

Pastikan penjelasan mudah dipahami oleh seseorang yang baru belajar analisis data. Mulai langsung dengan metode pertama.`;

        try {
            const response = await fetch(geminiProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: guidePrompt })
            });
            const result = await response.json();
            const guideText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal memuat panduan. Coba lagi.";
            
            if (typeof marked !== 'undefined') {
                guideContent.innerHTML = marked.parse(guideText);
            } else {
                guideContent.textContent = guideText;
            }
        } catch (error) {
            guideContent.innerHTML = `<p class="message error">Gagal memuat panduan. Periksa koneksi Anda dan coba lagi.</p>`;
            console.error("Error fetching guide:", error);
        } finally {
            guideLoader.classList.add('hidden');
        }
    };

    // Event listener untuk tombol kembali dari halaman panduan
    backToAnalyzerBtn.addEventListener('click', () => {
        analysisGuidePage.classList.add('hidden');
        dataAnalyzerPage.classList.remove('hidden');
    });

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
        analysisResultContent.textContent = '';

        const dataString = JSON.stringify(parsedCsvData, null, 2);

        const fullPrompt = `
Anda adalah seorang analis data profesional. Diberikan data dalam format JSON berikut dan sebuah permintaan dari pengguna.

Data:
${dataString}

Permintaan Pengguna:
"${userPrompt}"

Tugas Anda:
1. Lakukan analisis sesuai permintaan pengguna.
2. Berikan jawaban yang jelas, terstruktur, dan mudah dipahami.
3. Jika diminta melakukan regresi, sertakan ringkasan model, koefisien, dan interpretasi hasilnya.
4. Jika diminta statistik deskriptif, berikan tabel yang rapi.
5. Gunakan format **Markdown** untuk jawaban Anda (heading, list, tabel, bold). Mulai jawaban Anda langsung dengan hasil analisis, tanpa basa-basi pembukaan.`;

        try {
            const response = await fetch(geminiProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: fullPrompt })
            });
            const result = await response.json();
            const analysisText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, gagal mendapatkan hasil analisis. Coba lagi.";            
            if (typeof marked !== 'undefined') {
                analysisResultContent.innerHTML = marked.parse(analysisText);
            } else {
                analysisResultContent.textContent = analysisText; // Fallback
            }
        } catch (error) {
            // Tangkap error dari fetch atau parsing JSON
            let errorMessage = "Terjadi kesalahan saat menghubungi server AI. Silakan coba lagi nanti.";
            if (error.message) {
                errorMessage = `Terjadi kesalahan: ${error.message}`;
            }
            analysisResultContent.textContent = errorMessage;
            console.error("Error running analysis:", error);
        } finally {
            analysisLoader.classList.add('hidden');
        }
    });
});
