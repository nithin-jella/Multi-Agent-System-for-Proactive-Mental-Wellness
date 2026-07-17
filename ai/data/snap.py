"""
### INSTRUKSI:
Anda adalah sebuah pipeline ekstraksi Knowledge Graph untuk domain kesehatan mental. 
Dari DOKUMEN yang diberikan, ekstrak semua entitas penting dan relasi di antara mereka. 
Patuhi struktur JSON dan daftar tipe yang telah ditentukan dengan ketat.

### LANGKAH-LANGKAH:
1.  Ekstrak Entitas: Identifikasi entitas, klasifikasikan tipenya, dan berikan deskripsi singkat dari teks.
2.  Ekstrak Relasi: Identifikasi hubungan langsung antar entitas tersebut. `name` relasi harus berupa frasa kerja dari teks, dan `type` adalah kategorisasi formalnya.

### Sistem Tipe (Ontologi)

A. Tipe Entitas yang Diizinkan:
* Gangguan & Kondisi: `Gangguan_Mental`, `Gejala`, `Kondisi_Medis_Terkait`
* Intervensi & Perawatan: `Terapi_Psikologis`, `Obat_Medis`, `Layanan_Kesehatan`, `Aktivitas_Kesejahteraan`
* Aktor & Pemangku Kepentingan: `Profesional_Kesehatan`, `Organisasi`, `Individu`
* Faktor & Konteks: `Faktor_Risiko`, `Faktor_Pelindung`, `Dokumen_Hukum_Kebijakan`, `Lokasi`
* Data & Konsep: `Data_Statistik`, `Konsep_Abstrak`
* Jaring Pengaman: `Lainnya` (Gunakan untuk entitas penting yang tidak cocok dengan kategori lain)

B. Tipe Relasi yang Diizinkan:
* Sebab-Akibat: `Menyebabkan`, `Berkontribusi_Pada`, `Mengurangi_Risiko`, `Merupakan_Gejala_Dari`
* Intervensi: `Mendiagnosis`, `Menangani`, `Meresepkan`, `Menawarkan_Layanan`
* Hierarki & Keanggotaan: `Adalah_Jenis_Dari`, `Bekerja_Di`, `Berlokasi_Di`
* Deskriptif: `Memiliki_Atribut`, `Didasarkan_Pada`, `Direkomendasikan_Untuk`
* Jaring Pengaman: `Terkait_Dengan` (Gunakan untuk hubungan yang jelas tapi tidak cocok kategori lain)

### Struktur Output JSON
{
"entities": [{ 
    "name": "nama_entitas",
    "type": "tipe_entitas_dari_daftar_di_atas",
    "description": "penjelasan singkat atau kutipan dari dokumen"
    }
  ],
"relations": [{
    "source_entity": "nama_entitas_sumber",
    "target_entity": "nama_entitas_target",
    "name": "frasa_kerja_dari_dokumen",
    "type": "tipe_relasi_dari_daftar_di_atas"
    }
  ]
}


### CONTOH EKSEKUSI

### DOKUMEN:
Kesehatan Jiwa adalah kondisi dimana seorang individu dapat berkembang secara fisik, mental, spiritual, dan sosial. K
arakteristik gangguan jiwa secara umum yaitu kombinasi pikiran yang abnormal, emosi, dan persepsi. 
Faktor psikologis seperti trauma yang mengakibatkan stres dan faktor biologis seperti genetik merupakan faktor yang berkontribusi terhadap terjadinya gangguan jiwa. 
Sebesar 50% gangguan jiwa berawal pada usia 14 tahun.

### JSON_OUTPUT:
{ "entities": [{
    "name": "Kesehatan Jiwa",
    "type": "Konsep_Abstrak",
    "description": "kondisi dimana seorang individu dapat berkembang secara fisik, mental, spiritual, dan sosial."},
    
    {"name": "Gangguan Jiwa",
    "type": "Gangguan_Mental",
    "description": "Sebuah kondisi yang memiliki karakteristik seperti kombinasi pikiran abnormal, dan dipengaruhi oleh faktor psikologis serta biologis."},

    {"name": "Karakteristik Gangguan Jiwa",
    "type": "Karakteristik",
    "description": "kombinasi pikiran yang abnormal, emosi, dan persepsi."},
    
    {"name": "Faktor Psikologis",
    "type": "Faktor_Risiko",
    "description": "Faktor yang dapat mengakibatkan stres, contohnya trauma."},
    
    {"name": "Faktor Biologis",
    "type": "Faktor_Risiko",
    "description": "Faktor yang berkontribusi pada gangguan jiwa, contohnya genetik."},
    
    {"name": "Stres",
    "type": "Gejala",
    "description": "Sebuah kondisi yang diakibatkan oleh faktor psikologis seperti trauma."},
    
    {"name": "Statistik Onset Gangguan Jiwa",
    "type": "Data_Statistik",
    "description": "Sebesar 50% gangguan jiwa berawal pada usia 14 tahun."}
],
"relations": [{
    "source_entity": "Gangguan Jiwa",
    "target_entity": "Karakteristik Gangguan Jiwa",
    "name": "memiliki karakteristik",
    "type": "Memiliki_Atribut"},
    
    {"source_entity": "Faktor Psikologis",
    "target_entity": "Stres",
    "name": "mengakibatkan",
    "type": "Menyebabkan"},
    
    {"source_entity": "Faktor Psikologis",
    "target_entity": "Gangguan Jiwa",
    "name": "berkontribusi terhadap",
    "type": "Berkontribusi_Pada"},
    
    {"source_entity": "Faktor Biologis",
    "target_entity": "Gangguan Jiwa",
    "name": "berkontribusi terhadap",
    "type": "Berkontribusi_Pada"},
    
    {"source_entity": "Gangguan Jiwa",
    "target_entity": "Statistik Onset Gangguan Jiwa",
    "name": "memiliki data onset",
    "type": "Memiliki_Atribut"}]}

        UPAYA PROMOTIF DAN PREVENTIF
        Upaya Promotif
        Upaya promotif ditujukan untuk:
        mempertahankan dan meningkatkan derajat kesehatan jiwa masyarakat secara optimal;
        meningkatkan kesadaran dan pemahaman individu/ masyarakat tentang Kesehatan jiwa
        menghilangkan stigma dan diskriminasi
        meningkatkan pemahaman, peran serta dan penerimaan masyarakat terhadap GME
        Upaya promotif kesehatan jiwa untuk mencegah GME terintegrasi dengan upaya promosi kesehatan lainnya yang dilaksanakan oleh setiap jenjang administrasi dan layanan kesehatan di keluarga, lingkungan pendidikan, masyarakat, fasyankes, panti/lembaga sosial dan lembaga pemas- yarakatan.
        Fokus promosi kesehatan untuk pencegahan dan pengen- dalian GME dengan prinsip leaving no one behind dimulai melalui pelayanan berbasis komunitas di pelayanan primer yang terintegrasi didukung oleh pendekatan kesehatan digital dan sistem inovasi, kolaborasi multiprofesi serta koordinasi lintas program dan sektor.
        Upaya promotif yang dimaksud dalam juknis ini mencakup dua hal yaitu 1) promosi kesehatan sesuai alur layanan GME dan 2) promosi kesehatan lebih luas.
        Promosi kesehatan sesuai alur layanan GME
        Sesuai alur layanan GME, promosi kesehatan yang dimaksud adalah upaya menjaga masyarakat pada kondisi sehat jiwa dengan memberikan informasi kesehatan secara langsung pada anggota masyarakat.
        Upaya promosi kesehatan ditujukan juga untuk pening- katan faktor protektif yaitu faktor biologi, psikologi dan sosial
        Upaya yang dilakukan:
        Melakukan kegiatan promosi kesehatan jiwa pada masyarakat, termasuk menyediakan materi komunikasi, informasi dan edukasi (KIE)
        Melakukan kerja sama dengan lembaga yang terkait dengan penemuan kasus (a.l. sekolah, panti sosial, fasyankes, Kecamatan/Kelurahan/RW/RT).
        Memotivasi orang dengan GME untuk mendapat layanan lebih lanjut (pencegahan dan pengobatan, jika diperlukan).
        Melakukan pencatatan dan 
    {
      "entities": [
        {
          "name": "Gangguan mental emosional",
          "type": "Gangguan_Mental",
          "description": "Suatu kondisi yang mengindikasikan seseorang mengalami perubahan psikologis, yang mungkin merupakan kondisi normal atau patologis."
        },
        {
          "name": "Perubahan psikologis",
          "type": "Gejala",
          "description": "Kondisi yang dialami seseorang yang mungkin mengindikasikan gangguan mental emosional, bisa normal atau patologis."
        },
        {
          "name": "Kondisi normal",
          "type": "Konsep_Abstrak",
          "description": "Kondisi psikologis yang tidak mengindikasikan adanya patologi."
        },
        {
          "name": "Kondisi patologis",
          "type": "Konsep_Abstrak",
          "description": "Kondisi psikologis yang mengindikasikan adanya penyakit atau gangguan."
        }, ... ],
      "relations": [
        {
          "source_entity": "Gangguan mental emosional",
          "target_entity": "Perubahan psikologis",
          "name": "mengindikasikan adanya",
          "type": "Memiliki_Atribut"
        },
        {
          "source_entity": "Perubahan psikologis",
          "target_entity": "Kondisi normal",
          "name": "merupakan",
          "type": "Adalah_Jenis_Dari"
        },
        {
          "source_entity": "Perubahan psikologis",
          "target_entity": "Kondisi patologis",
          "name": "merupakan",
          "type": "Adalah_Jenis_Dari"
        },
        {
          "source_entity": "Gangguan mental emosional",
          "target_entity": "Survei kesehatan rumah tangga (SKRT) tahun 1995",
          "name": "digunakan dalam",
          "type": "Terkait_Dengan"
        }, ... ]
    }
"""
"""
Tugas: Klasifikasikan kueri pengguna ke dalam kategori 'entity_query' atau 'path_query', dan ekstrak semua entitas yang relevan.

Definisi:
'entity_query' (Query Atribut/Node): Pertanyaan yang fokus untuk mendeskripsikan atau mengambil properti/atribut dari sebuah konsep sentral. Contoh: "Apa itu X?", "Apa saja gejala dari X?".
'path_query' (Query Relasi/Edge): Pertanyaan tentang hubungan antara dua atau lebih entitas, atau mencari alur/proses. Contoh: "Bagaimana hubungan A dan B?", "Cari A yang terkait dengan B?".

Output Format (JSON):
{{
"category": "entity_query" | "path_query",
"entities": ["Entity 1", "Entity 2", ..., "Entity N"]
}}

Contoh:

Query: "Apa itu depresi dan bagaimana gejalanya?"
Output: {{"category": "entity_query", "entities": ["depresi"]}}

Query: "Apa saja jenis obat antidepresan yang umum diresepkan?"
Output: {{"category": "entity_query", "entities": ["obat antidepresan"]}}

Query: "Bagaimana cara kerja terapi kognitif-perilaku (CBT) untuk kecemasan?"
Output: {{"category": "path_query", "entities": ["terapi kognitif-perilaku (CBT)", "kecemasan"]}}

Query: "Jelaskan peran serotonin dalam gangguan mood."
Output: {{"category": "path_query", "entities": ["serotonin", "gangguan mood"]}}

Query: "Bisakah olahraga membantu mengurangi stres dan meningkatkan kesehatan mental?"
Output: {{"category": "path_query", "entities": ["olahraga", "stres", "kesehatan mental"]}}

Query: "Layanan dukungan kesehatan mental apa saja yang tersedia untuk remaja di Jakarta?"
Output: {{"category": "path_query", "entities": ["layanan dukungan kesehatan mental", "remaja", "Jakarta"]}}

Query: "Siapa psikolog yang spesialisasi di terapi trauma?"
Output: {{"category": "path_query", "entities": ["psikolog", "terapi trauma"]}}

---
Klasifikasikan dan ekstrak entitas untuk kueri berikut:

Query:
{query}
"""