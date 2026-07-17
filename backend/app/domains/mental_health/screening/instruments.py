"""Validated Psychological Instrument Domains.

This module defines the specific domains assessed by each validated
psychological screening instrument. These domains guide the LLM's
extraction of mental health indicators from conversation.

References:
- All instruments are widely validated and used internationally
- Indonesian adaptations exist for most instruments
- Domain definitions follow original instrument specifications
"""
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class InstrumentDomain:
    """A domain assessed by a psychological instrument."""
    name: str
    description: str
    keywords_en: List[str]
    keywords_id: List[str]  # Indonesian keywords
    weight: float = 1.0  # Relative importance in the instrument


# =============================================================================
# PHQ-9: Patient Health Questionnaire-9 (Depression)
# Reference: Kroenke et al. (2001). Journal of General Internal Medicine, 16(9), 606-613.
# Indonesian validation: Kuntjoro et al. (2014)
# =============================================================================
PHQ9_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="anhedonia",
        description="Little interest or pleasure in doing things",
        keywords_en=["no interest", "don't enjoy", "nothing fun", "lost passion", "bored with everything"],
        keywords_id=["nggak ada minat", "tidak menikmati", "bosan", "males", "nggak semangat"],
        weight=1.2,  # Core symptom
    ),
    InstrumentDomain(
        name="depressed_mood",
        description="Feeling down, depressed, or hopeless",
        keywords_en=["sad", "depressed", "hopeless", "empty", "down", "blue", "miserable"],
        keywords_id=["sedih", "murung", "putus asa", "kosong", "galau", "nggak ada harapan"],
        weight=1.2,  # Core symptom
    ),
    InstrumentDomain(
        name="sleep_disturbance",
        description="Trouble falling or staying asleep, or sleeping too much",
        keywords_en=["can't sleep", "insomnia", "sleeping too much", "wake up at night", "tired"],
        keywords_id=["susah tidur", "insomnia", "kebanyakan tidur", "bangun tengah malam", "lelah"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="fatigue",
        description="Feeling tired or having little energy",
        keywords_en=["tired", "exhausted", "no energy", "drained", "fatigue", "weak"],
        keywords_id=["capek", "lelah", "nggak ada tenaga", "lemes", "loyo"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="appetite_change",
        description="Poor appetite or overeating",
        keywords_en=["not hungry", "lost appetite", "eating too much", "comfort eating", "no appetite"],
        keywords_id=["nggak nafsu makan", "makan berlebihan", "nggak mau makan", "makan terus"],
        weight=0.8,
    ),
    InstrumentDomain(
        name="worthlessness",
        description="Feeling bad about yourself, or that you are a failure",
        keywords_en=["worthless", "failure", "let everyone down", "hate myself", "useless", "burden"],
        keywords_id=["nggak berguna", "gagal", "mengecewakan", "benci diri sendiri", "beban"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="concentration",
        description="Trouble concentrating on things, such as reading or watching TV",
        keywords_en=["can't concentrate", "distracted", "can't focus", "mind wanders", "foggy"],
        keywords_id=["susah konsentrasi", "nggak fokus", "pikiran kemana-mana", "blank"],
        weight=0.8,
    ),
    InstrumentDomain(
        name="psychomotor",
        description="Moving or speaking slowly, or being fidgety/restless",
        keywords_en=["moving slowly", "restless", "can't sit still", "sluggish", "agitated"],
        keywords_id=["gerak lambat", "gelisah", "nggak bisa diam", "lamban"],
        weight=0.7,
    ),
    InstrumentDomain(
        name="suicidal_ideation",
        description="Thoughts of self-harm or being better off dead",
        keywords_en=["want to die", "better off dead", "kill myself", "suicidal", "end it all", "self-harm"],
        keywords_id=["ingin mati", "lebih baik mati", "bunuh diri", "menyakiti diri"],
        weight=2.0,  # Critical - highest weight
    ),
]


# =============================================================================
# GAD-7: Generalized Anxiety Disorder-7
# Reference: Spitzer et al. (2006). Archives of Internal Medicine, 166(10), 1092-1097.
# Indonesian validation: Aryani et al. (2017)
# =============================================================================
GAD7_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="nervous",
        description="Feeling nervous, anxious, or on edge",
        keywords_en=["nervous", "anxious", "on edge", "tense", "uneasy", "jittery"],
        keywords_id=["gugup", "cemas", "tegang", "nggak tenang", "was-was"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="uncontrollable_worry",
        description="Not being able to stop or control worrying",
        keywords_en=["can't stop worrying", "overthinking", "mind racing", "constant worry"],
        keywords_id=["nggak bisa berhenti khawatir", "kepikiran terus", "pikiran nggak bisa berhenti"],
        weight=1.2,
    ),
    InstrumentDomain(
        name="excessive_worry",
        description="Worrying too much about different things",
        keywords_en=["worry about everything", "anxious about many things", "worried all the time"],
        keywords_id=["khawatir berlebihan", "cemas banyak hal", "khawatir terus"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="trouble_relaxing",
        description="Trouble relaxing",
        keywords_en=["can't relax", "always tense", "wound up", "can't unwind"],
        keywords_id=["nggak bisa santai", "tegang terus", "nggak bisa rileks"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="restlessness",
        description="Being so restless that it's hard to sit still",
        keywords_en=["restless", "fidgety", "can't sit still", "need to move"],
        keywords_id=["gelisah", "nggak bisa diam", "resah"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="irritability",
        description="Becoming easily annoyed or irritable",
        keywords_en=["irritable", "easily annoyed", "snappy", "short-tempered", "frustrated"],
        keywords_id=["mudah kesal", "gampang marah", "sensitif", "jengkel"],
        weight=0.8,
    ),
    InstrumentDomain(
        name="fear_of_awful",
        description="Feeling afraid as if something awful might happen",
        keywords_en=["something bad will happen", "doom", "dread", "fear of the worst", "panic"],
        keywords_id=["takut sesuatu buruk terjadi", "firasat buruk", "panik", "ngeri"],
        weight=1.1,
    ),
]


# =============================================================================
# DASS-21 Stress Subscale
# Reference: Lovibond & Lovibond (1995). Behaviour Research and Therapy, 33(3), 335-343.
# Indonesian validation: Damanik (2006)
# =============================================================================
DASS21_STRESS_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="difficulty_relaxing",
        description="Found it hard to wind down or relax",
        keywords_en=["can't wind down", "always on", "can't switch off", "wound up"],
        keywords_id=["susah rileks", "nggak bisa tenang", "tegang terus"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="nervous_energy",
        description="Tended to over-react to situations",
        keywords_en=["overreact", "blown out of proportion", "explosive", "dramatic reaction"],
        keywords_id=["reaksi berlebihan", "terlalu sensitif", "meledak-ledak"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="agitation",
        description="Felt that I was using a lot of nervous energy",
        keywords_en=["on edge", "keyed up", "exhausted from stress", "drained"],
        keywords_id=["tegang", "energi habis karena stres", "terkuras"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="irritable_overreactive",
        description="Found myself getting agitated easily",
        keywords_en=["easily agitated", "quick to anger", "short fuse", "snap easily"],
        keywords_id=["mudah tersulut", "cepat marah", "gampang kesal"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="impatience",
        description="Found it difficult to tolerate delays",
        keywords_en=["impatient", "can't wait", "frustrated by delays", "rushing"],
        keywords_id=["nggak sabar", "frustasi nunggu", "terburu-buru"],
        weight=0.8,
    ),
    InstrumentDomain(
        name="overwhelm",
        description="Felt I was close to breaking point",
        keywords_en=["overwhelmed", "breaking point", "can't cope", "too much", "burnout"],
        keywords_id=["kewalahan", "nggak kuat lagi", "terlalu banyak", "burnout"],
        weight=1.2,
    ),
    InstrumentDomain(
        name="intolerance",
        description="Was intolerant of anything that kept me from getting on with what I was doing",
        keywords_en=["frustrated by interruptions", "can't handle distractions", "need everything perfect"],
        keywords_id=["frustasi diganggu", "nggak tahan gangguan", "harus sempurna"],
        weight=0.8,
    ),
]


# =============================================================================
# PSQI: Pittsburgh Sleep Quality Index
# Reference: Buysse et al. (1989). Psychiatry Research, 28(2), 193-213.
# Indonesian validation: Setyowati & Chung (2020)
# =============================================================================
PSQI_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="sleep_quality",
        description="Subjective sleep quality",
        keywords_en=["sleep badly", "poor sleep", "restless sleep", "good sleep", "peaceful sleep"],
        keywords_id=["tidur nggak nyenyak", "tidur buruk", "tidur gelisah", "tidur nyenyak"],
        weight=1.2,
    ),
    InstrumentDomain(
        name="sleep_latency",
        description="Time to fall asleep",
        keywords_en=["can't fall asleep", "takes long to sleep", "lying awake", "fall asleep quickly"],
        keywords_id=["susah tidur", "lama baru tidur", "berbaring lama", "cepat tidur"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="sleep_duration",
        description="Hours of actual sleep per night",
        keywords_en=["only few hours", "sleep 3 hours", "sleep 4 hours", "enough sleep", "8 hours"],
        keywords_id=["tidur cuma", "jam tidur", "cukup tidur", "kurang tidur"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="sleep_efficiency",
        description="Percentage of time in bed actually sleeping",
        keywords_en=["tossing and turning", "awake in bed", "can't stay asleep", "sleep through"],
        keywords_id=["bolak-balik", "terjaga di kasur", "nggak bisa tidur terus", "tidur pulas"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="sleep_disturbances",
        description="Frequency of sleep problems",
        keywords_en=["wake up at night", "bad dreams", "nightmares", "sleep interrupted"],
        keywords_id=["bangun tengah malam", "mimpi buruk", "tidur terganggu"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="sleep_medication",
        description="Use of sleeping medication",
        keywords_en=["sleeping pills", "medication to sleep", "need pills", "natural sleep"],
        keywords_id=["obat tidur", "minum obat buat tidur", "butuh obat"],
        weight=0.7,
    ),
    InstrumentDomain(
        name="daytime_dysfunction",
        description="Daytime problems due to poor sleep",
        keywords_en=["sleepy during day", "tired all day", "can't stay awake", "nap needed"],
        keywords_id=["ngantuk siang", "capek seharian", "nggak bisa tahan ngantuk"],
        weight=1.1,
    ),
]


# =============================================================================
# UCLA Loneliness Scale (Version 3)
# Reference: Russell (1996). Journal of Personality Assessment, 66(1), 20-40.
# Indonesian validation: Wongpakaran et al. (2020)
# =============================================================================
UCLA_LONELINESS_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="social_loneliness",
        description="Lack of social network and connections",
        keywords_en=["no friends", "alone", "isolated", "nobody to talk to", "no one around"],
        keywords_id=["nggak punya teman", "sendirian", "terisolasi", "nggak ada yang diajak ngobrol"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="emotional_loneliness",
        description="Absence of intimate attachment figure",
        keywords_en=["nobody understands", "no one to confide in", "emotionally alone", "no close friends"],
        keywords_id=["nggak ada yang mengerti", "nggak bisa curhat", "nggak ada yang dekat"],
        weight=1.1,
    ),
    InstrumentDomain(
        name="perceived_isolation",
        description="Feeling left out or excluded",
        keywords_en=["left out", "excluded", "not part of group", "outsider", "don't belong"],
        keywords_id=["dikucilkan", "nggak dilibatkan", "nggak termasuk", "outsider"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="social_withdrawal",
        description="Withdrawing from social situations",
        keywords_en=["stay home", "avoid people", "don't want to go out", "prefer being alone"],
        keywords_id=["di rumah aja", "menghindari orang", "males keluar", "menarik diri"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="companionship",
        description="Having companions and people to be with",
        keywords_en=["have friends", "people to hang out with", "social activities", "good friends"],
        keywords_id=["punya teman", "ada yang diajak jalan", "aktif sosial", "teman baik"],
        weight=1.0,  # Protective factor
    ),
]


# =============================================================================
# RSES: Rosenberg Self-Esteem Scale
# Reference: Rosenberg (1965). Society and the adolescent self-image.
# Indonesian validation: Sari & Dahlia (2018)
# =============================================================================
RSES_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="self_worth",
        description="Feeling of personal worth",
        keywords_en=["worthless", "valuable person", "good qualities", "feel important"],
        keywords_id=["nggak berharga", "berharga", "kualitas baik", "penting"],
        weight=1.2,
    ),
    InstrumentDomain(
        name="self_acceptance",
        description="Accepting oneself including flaws",
        keywords_en=["accept myself", "hate myself", "okay with who I am", "self-critical"],
        keywords_id=["terima diri", "benci diri sendiri", "oke dengan diri", "mengkritik diri"],
        weight=1.1,
    ),
    InstrumentDomain(
        name="self_competence",
        description="Feeling capable and competent",
        keywords_en=["can do things", "capable", "useless", "incompetent", "good at things"],
        keywords_id=["bisa melakukan", "mampu", "nggak berguna", "nggak kompeten", "jago"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="comparative_worth",
        description="Comparing self to others",
        keywords_en=["worse than others", "as good as others", "not good enough", "better than"],
        keywords_id=["lebih buruk dari orang lain", "sama baiknya", "nggak cukup baik", "lebih baik dari"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="self_respect",
        description="Respect for oneself",
        keywords_en=["respect myself", "no self-respect", "proud of myself", "ashamed of myself"],
        keywords_id=["menghargai diri", "nggak punya harga diri", "bangga", "malu"],
        weight=1.0,
    ),
]


# =============================================================================
# AUDIT: Alcohol Use Disorders Identification Test
# Reference: Saunders et al. (1993). Addiction, 88(6), 791-804.
# Indonesian validation: Noegroho et al. (2009)
# =============================================================================
AUDIT_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="hazardous_use",
        description="Frequency and quantity of alcohol use",
        keywords_en=["drink often", "drink a lot", "how much alcohol", "drinking daily", "heavy drinking"],
        keywords_id=["sering minum", "minum banyak", "mabuk", "minum tiap hari"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="dependence_symptoms",
        description="Signs of alcohol dependence",
        keywords_en=["need to drink", "can't stop drinking", "drink in morning", "withdrawal", "craving"],
        keywords_id=["butuh minum", "nggak bisa berhenti", "minum pagi", "sakau"],
        weight=1.3,
    ),
    InstrumentDomain(
        name="harmful_use",
        description="Problems caused by alcohol use",
        keywords_en=["problems from drinking", "regret drinking", "hurt someone drunk", "blackout"],
        keywords_id=["masalah karena minum", "menyesal minum", "lupa saat mabuk"],
        weight=1.2,
    ),
    InstrumentDomain(
        name="coping_drinking",
        description="Using alcohol to cope with stress or emotions",
        keywords_en=["drink to forget", "drink to relax", "drink when stressed", "drink to cope"],
        keywords_id=["minum untuk lupa", "minum biar tenang", "minum saat stres"],
        weight=1.1,
    ),
]


# =============================================================================
# C-SSRS: Columbia Suicide Severity Rating Scale
# Reference: Posner et al. (2011). American Journal of Psychiatry, 168(12), 1266-1277.
# Any positive finding requires immediate escalation
# =============================================================================
CSSRS_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="wish_to_be_dead",
        description="Wish to be dead or not alive anymore",
        keywords_en=["wish I was dead", "better if I wasn't here", "want to not exist", "tired of living"],
        keywords_id=["ingin mati", "lebih baik nggak ada", "capek hidup", "mau hilang"],
        weight=2.0,
    ),
    InstrumentDomain(
        name="suicidal_thoughts",
        description="General non-specific suicidal thoughts",
        keywords_en=["kill myself", "end my life", "suicidal", "suicide", "want to die"],
        keywords_id=["bunuh diri", "mengakhiri hidup", "mau mati"],
        weight=2.5,
    ),
    InstrumentDomain(
        name="suicidal_intent",
        description="Suicidal thoughts with intent but no plan",
        keywords_en=["going to do it", "planning to die", "made up my mind", "decided to"],
        keywords_id=["akan melakukan", "sudah memutuskan", "sudah mantap"],
        weight=3.0,
    ),
    InstrumentDomain(
        name="suicidal_plan",
        description="Suicidal thoughts with specific plan",
        keywords_en=["how I'll do it", "method", "plan to", "when I'll", "specific way"],
        keywords_id=["caranya", "metode", "rencana", "kapan aku akan"],
        weight=3.5,
    ),
    InstrumentDomain(
        name="self_harm",
        description="Non-suicidal self-injury",
        keywords_en=["cutting", "hurt myself", "self-harm", "burning myself", "hitting myself"],
        keywords_id=["menyayat", "menyakiti diri", "self-harm", "membakar diri", "memukul diri"],
        weight=2.0,
    ),
    InstrumentDomain(
        name="preparatory_behavior",
        description="Preparations for suicide attempt",
        keywords_en=["saying goodbye", "giving away things", "writing note", "preparations"],
        keywords_id=["pamit", "memberikan barang", "menulis surat", "persiapan"],
        weight=3.0,
    ),
]


# =============================================================================
# Academic Stress (University-Specific)
# Reference: Student Stress Inventory (SSI) by Lakaev (2009)
# Adapted for Indonesian university context
# =============================================================================
ACADEMIC_STRESS_DOMAINS: List[InstrumentDomain] = [
    InstrumentDomain(
        name="academic_pressure",
        description="Pressure from academic demands",
        keywords_en=["too much work", "deadlines", "assignments", "exams", "overwhelmed by school"],
        keywords_id=["terlalu banyak tugas", "deadline", "ujian", "kewalahan kuliah"],
        weight=1.0,
    ),
    InstrumentDomain(
        name="fear_of_failure",
        description="Fear of academic failure",
        keywords_en=["afraid to fail", "fail exam", "drop out", "not graduate", "low grades"],
        keywords_id=["takut gagal", "gagal ujian", "DO", "nggak lulus", "nilai jelek", "IPK turun"],
        weight=1.1,
    ),
    InstrumentDomain(
        name="thesis_stress",
        description="Stress related to thesis/dissertation",
        keywords_en=["thesis stuck", "can't finish thesis", "advisor problems", "thesis deadline"],
        keywords_id=["skripsi macet", "nggak bisa selesaikan skripsi", "dosen pembimbing", "TA"],
        weight=1.2,
    ),
    InstrumentDomain(
        name="academic_comparison",
        description="Comparing academic performance with peers",
        keywords_en=["everyone does better", "behind classmates", "not smart enough", "others succeed"],
        keywords_id=["orang lain lebih baik", "ketinggalan teman", "nggak pintar", "teman sukses"],
        weight=0.9,
    ),
    InstrumentDomain(
        name="future_anxiety",
        description="Anxiety about future career after graduation",
        keywords_en=["job after graduation", "no future", "unemployed", "career anxiety", "what next"],
        keywords_id=["kerja setelah lulus", "nggak ada masa depan", "pengangguran", "karir"],
        weight=1.0,
    ),
]
