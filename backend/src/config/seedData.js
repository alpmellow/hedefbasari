const INITIAL_STAFF = [
  {
    id: 'teacher-1',
    tcNo: '10000000146',
    securityKey: 'HB8842X9',
    fullName: 'Dr. Selim Kaya',
    branch: 'İleri Matematik & Geometri',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    biography: '14 yıllık YKS/AYT derece koçluğu ve olimpiyat matematik komitesi deneyimi. Türev, İntegral ve Analitik Geometri uzmanı.',
    weeklySchedule: [
      { day: 'Pazartesi', hourSlot: 1, status: 'occupied' },
      { day: 'Pazartesi', hourSlot: 2, status: 'occupied' },
      { day: 'Pazartesi', hourSlot: 3, status: 'occupied' },
      { day: 'Pazartesi', hourSlot: 4, status: 'occupied' },
      { day: 'Pazartesi', hourSlot: 6, status: 'free' },
      { day: 'Pazartesi', hourSlot: 7, status: 'free' },
      { day: 'Pazartesi', hourSlot: 8, status: 'free' },
      { day: 'Salı', hourSlot: 1, status: 'occupied' },
      { day: 'Salı', hourSlot: 2, status: 'occupied' },
      { day: 'Salı', hourSlot: 6, status: 'free' },
      { day: 'Salı', hourSlot: 7, status: 'free' },
      { day: 'Çarşamba', hourSlot: 6, status: 'free' },
      { day: 'Çarşamba', hourSlot: 7, status: 'free' },
      { day: 'Perşembe', hourSlot: 5, status: 'free' },
      { day: 'Perşembe', hourSlot: 6, status: 'free' },
      { day: 'Cuma', hourSlot: 7, status: 'free' },
      { day: 'Cuma', hourSlot: 8, status: 'free' },
      { day: 'Cumartesi', hourSlot: 5, status: 'free' },
      { day: 'Cumartesi', hourSlot: 6, status: 'free' },
      { day: 'Pazar', hourSlot: 4, status: 'free' }
    ]
  },
  {
    id: 'teacher-2',
    tcNo: '20000000192',
    securityKey: 'HB9931K4',
    fullName: 'Yük. Müh. Elif Demir',
    branch: 'Fizik & Modern Kuantum',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&auto=format&fit=crop&q=80',
    biography: 'İTÜ Fizik Mühendisliği yüksek lisans mezunu. AYT Elektromanyetizma, Mekanik ve hızlı soru çözüm teknikleri koçu.',
    weeklySchedule: [
      { day: 'Pazartesi', hourSlot: 5, status: 'free' },
      { day: 'Pazartesi', hourSlot: 6, status: 'free' },
      { day: 'Salı', hourSlot: 1, status: 'occupied' },
      { day: 'Salı', hourSlot: 2, status: 'occupied' },
      { day: 'Salı', hourSlot: 3, status: 'occupied' },
      { day: 'Salı', hourSlot: 6, status: 'free' },
      { day: 'Salı', hourSlot: 7, status: 'free' },
      { day: 'Çarşamba', hourSlot: 5, status: 'free' },
      { day: 'Perşembe', hourSlot: 6, status: 'free' },
      { day: 'Perşembe', hourSlot: 7, status: 'free' },
      { day: 'Cuma', hourSlot: 6, status: 'free' },
      { day: 'Cumartesi', hourSlot: 5, status: 'free' },
      { day: 'Pazar', hourSlot: 5, status: 'free' }
    ]
  },
  {
    id: 'teacher-3',
    tcNo: '40000000258',
    securityKey: 'HB7720M2',
    fullName: 'Doç. Dr. Burak Soylu',
    branch: 'Organik Kimya & Biyokimya',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    biography: 'Tıp fakültesi hedefli öğrenciler için AYT Organik Kimya, Kimyasal Denge ve Elektrokimya özel mentorluğu.',
    weeklySchedule: [
      { day: 'Pazartesi', hourSlot: 1, status: 'occupied' },
      { day: 'Pazartesi', hourSlot: 7, status: 'free' },
      { day: 'Salı', hourSlot: 5, status: 'free' },
      { day: 'Çarşamba', hourSlot: 6, status: 'free' },
      { day: 'Çarşamba', hourSlot: 7, status: 'free' },
      { day: 'Perşembe', hourSlot: 8, status: 'free' },
      { day: 'Cuma', hourSlot: 5, status: 'free' },
      { day: 'Cumartesi', hourSlot: 6, status: 'free' },
      { day: 'Cumartesi', hourSlot: 7, status: 'free' },
      { day: 'Pazar', hourSlot: 6, status: 'free' }
    ]
  },
  {
    id: 'teacher-4',
    tcNo: '50000000314',
    securityKey: 'HB6519T8',
    fullName: 'Zeynep Aksoy',
    branch: 'Türkçe & Paragraf Stratejileri',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
    biography: 'TYT Türkçe hız-isabet optimizasyonu, anlam bilgisi ve AYT Edebiyat hafıza teknikleri koordinatörü.',
    weeklySchedule: [
      { day: 'Pazartesi', hourSlot: 6, status: 'free' },
      { day: 'Salı', hourSlot: 6, status: 'free' },
      { day: 'Çarşamba', hourSlot: 8, status: 'free' },
      { day: 'Perşembe', hourSlot: 6, status: 'free' },
      { day: 'Cuma', hourSlot: 6, status: 'free' },
      { day: 'Cuma', hourSlot: 7, status: 'free' },
      { day: 'Cumartesi', hourSlot: 4, status: 'free' },
      { day: 'Pazar', hourSlot: 4, status: 'free' }
    ]
  }
];

const INITIAL_STUDENTS = [
  { id: 'student-1', tcNo: '30000000138', pin: '482910', fullName: 'Arda Yılmaz', className: '12. Sınıf - SAY (Sayısal)', paymentStatus: 'Ödendi' },
  { id: 'student-2', tcNo: '30000000274', pin: '739104', fullName: 'Zeynep Kaya', className: '12. Sınıf - SAY (Sayısal)', paymentStatus: 'Ödendi' },
  { id: 'student-3', tcNo: '30000000391', pin: '518293', fullName: 'Mert Demirci', className: 'Mezun - SAY (Sayısal)', paymentStatus: 'Taksit Devam Ediyor' },
  { id: 'student-4', tcNo: '30000000419', pin: '904125', fullName: 'Ece Şahin', className: '12. Sınıf - EA (Eşit Ağırlık)', paymentStatus: 'Ödendi' }
];

module.exports = { INITIAL_STAFF, INITIAL_STUDENTS };