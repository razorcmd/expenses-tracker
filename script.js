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

    let userId = null;
    let detectedItems = [];
    let expenseChartInstance = null; // Untuk menyimpan instance chart

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

    // Tampilkan pesan saat aplikasi pertama kali mencoba terhubung
    showApiMessage("Menghubungkan ke server...", "success");

    // --- LOGIKA SINKRONISASI BARU ---
    const urlParams = new URLSearchParams(window.location.search);
    const uidFromUrl = urlParams.get('uid');

    if (uidFromUrl) {
        // Jika ada UID di URL, gunakan itu sebagai ID pengguna
        console.log("UID ditemukan di URL:", uidFromUrl);
        userId = uidFromUrl;
        hideApiMessage();
        setupRealtimeDataListener();
        // Tampilkan juga link sinkronisasinya agar mudah di-copy lagi
        syncLinkInput.value = window.location.href;
        syncSection.classList.remove('hidden');
    } else {
        // Jika tidak ada UID di URL, lakukan login anonim seperti biasa
        console.log("Tidak ada UID di URL, melakukan sign-in anonim...");
        authInstance.signInAnonymously().catch((error) => {
            console.error("Gagal melakukan autentikasi anonim:", error);
            showApiMessage("Gagal terhubung. Pastikan metode 'Anonymous' aktif di Firebase.", "error");
        });

        // Listener untuk mendapatkan UID baru setelah login berhasil
        authInstance.onAuthStateChanged((user) => {
            if (user && !userId) { // Pastikan hanya dijalankan sekali
                hideApiMessage();
                userId = user.uid;
                console.log("Berhasil login anonim, UID baru:", userId);
                const syncUrl = `${window.location.origin}${window.location.pathname}?uid=${userId}`;
                syncLinkInput.value = syncUrl;
                syncSection.classList.remove('hidden');
                setupRealtimeDataListener();
            }
        });
    }
});
