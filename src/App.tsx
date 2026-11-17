import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  Archive,
  BookOpen,
  CheckCircle2,
  CloudUpload,
  FileDown,
  FilePenLine,
  FileText,
  Info,
  Loader2,
  LogOut,
  Menu,
  Printer,
  RotateCcw,
  UserCheck,
  UserPen,
  UserRound,
  Zap,
} from 'lucide-react';
import { A4Preview } from './components/A4Preview';
import { ArchivePanel } from './components/ArchivePanel';
import { GuidePanel } from './components/GuidePanel';
import { LoginPage } from './components/LoginPage';
import { ReportForm } from './components/ReportForm';
import { StaffAdminPanel } from './components/StaffAdminPanel';
import { exportReportToDocx } from './lib/exportDocx';
import { exportReportToPdf } from './lib/exportPdf';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from './lib/firebase';
import { SAMPLE_FULL_REPORT } from './lib/sampleData';
import {
  ADMIN_EMAIL,
  AuthorizedStaff,
  STAFF_FIELD_LIMITS,
  StoredTravelReport,
  TravelReportData,
  createEmptyReport,
  sanitizeReportForFirestore,
} from './types/report';

type ActiveTab = 'editor' | 'archive' | 'guide' | 'staff';

const TEMP_ADMIN_STORAGE_KEY = 'silaper_temp_admin';
const LOCAL_REPORTS_STORAGE_KEY = 'silaper_local_reports';

function readLocalReports(): StoredTravelReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredTravelReport[]) : [];
  } catch {
    return [];
  }
}

function writeLocalReports(reports: StoredTravelReport[]) {
  try {
    localStorage.setItem(LOCAL_REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Ignore storage quota errors
  }
}

function mapFirebaseAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi tidak sesuai, atau akun belum didaftarkan oleh Administrator.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan oleh Administrator.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat lalu coba kembali.';
    case 'auth/operation-not-allowed':
      return 'Metode login Email & Kata Sandi belum diaktifkan pada Firebase Console (Authentication → Sign-in method).';
    case 'auth/unauthorized-domain':
      return 'Domain aplikasi ini belum didaftarkan pada Firebase Console (Authentication → Settings → Authorized domains).';
    case 'auth/popup-closed-by-user':
      return 'Jendela masuk Google ditutup sebelum proses selesai.';
    case 'auth/popup-blocked':
      return 'Popup login diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.';
    default:
      return err instanceof Error ? err.message : 'Gagal melakukan autentikasi.';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState<boolean>(true);
  const [report, setReport] = useState<TravelReportData>(() => createEmptyReport());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Auth, Access Gate & Firestore Archive state
  const [user, setUser] = useState<User | null>(null);
  const [isTempAdmin, setIsTempAdmin] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem(TEMP_ADMIN_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(false);
  const [accessGranted, setAccessGranted] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem(TEMP_ADMIN_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [needsEmailVerification, setNeedsEmailVerification] = useState<boolean>(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  const [savedReports, setSavedReports] = useState<StoredTravelReport[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activeReportOriginalStatus, setActiveReportOriginalStatus] = useState<'draft' | 'final' | null>(null);
  const [staffList, setStaffList] = useState<AuthorizedStaff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);

  // Action feedback states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationModalOpen, setValidationModalOpen] = useState<boolean>(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [showRequiredErrors, setShowRequiredErrors] = useState<boolean>(false);

  // User Profile & Menubar Pop-up Menu states
  const [profileName, setProfileName] = useState<string>('Staf Kecamatan');
  const [profileInstansi, setProfileInstansi] = useState<string>('Pemerintah Kecamatan');
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [editProfileOpen, setEditProfileOpen] = useState<boolean>(false);
  const [draftProfileName, setDraftProfileName] = useState<string>('');
  const [draftProfileInstansi, setDraftProfileInstansi] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  const validateRequiredReportSections = (): boolean => {
    const isHasilEmpty = !report.hasilPelaksanaan.trim();
    const isKesimpulanEmpty = !report.kesimpulanSaran.trim();
    const isPhotosEmpty = !report.photos || report.photos.length === 0;

    const messages: string[] = [];
    if (isHasilEmpty || isKesimpulanEmpty) {
      messages.push('V. HASIL PELAKSANAAN KEGIATAN dan VI. KESIMPULAN DAN SARAN wajib di isi');
    }
    if (isPhotosEmpty) {
      messages.push('04. Foto Dokumentasi Kegiatan wajib di isi');
    }

    if (messages.length > 0) {
      setValidationMessages(messages);
      setShowRequiredErrors(true);
      setValidationModalOpen(true);
      return false;
    }

    setValidationMessages([]);
    setShowRequiredErrors(false);
    return true;
  };

  const handleFocusRequiredField = () => {
    setValidationModalOpen(false);
    setActiveTab('editor');

    const isHasilEmpty = !report.hasilPelaksanaan.trim();
    const isKesimpulanEmpty = !report.kesimpulanSaran.trim();

    if (isHasilEmpty || isKesimpulanEmpty) {
      setIsUnlocked(true);
      setTimeout(() => {
        const targetId = isHasilEmpty ? 'hasilPelaksanaan' : 'kesimpulanSaran';
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 80);
      return;
    }

    setTimeout(() => {
      const photoEl = document.getElementById('section-foto-dokumentasi');
      if (photoEl) {
        photoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };

  const isAdminUser =
    isTempAdmin ||
    (Boolean(user?.email) &&
      user?.email?.trim().toLowerCase() === ADMIN_EMAIL &&
      user?.emailVerified === true);

  const verifyAccessAndSyncProfile = useCallback(async (currentUser: User): Promise<boolean> => {
    setIsCheckingAccess(true);
    try {
      const emailLower = (currentUser.email || '').trim().toLowerCase();
      const isGoogleProvider = currentUser.providerData.some(
        (p) => p.providerId === 'google.com',
      );

      // Firestore rules mandate verified email tokens for all authenticated accounts
      if (!currentUser.emailVerified) {
        setAccessGranted(false);
        setNeedsEmailVerification(true);
        return false;
      }

      setNeedsEmailVerification(false);

      const isAdminEmail = emailLower === ADMIN_EMAIL;
      let staffDisplayName = '';

      if (!isAdminEmail) {
        if (!emailLower) {
          await signOut(auth);
          setLoginError('Akun tidak memiliki alamat email yang valid.');
          setAccessGranted(false);
          return false;
        }

        const staffPath = `authorizedStaff/${emailLower}`;
        try {
          const staffSnap = await getDoc(doc(db, 'authorizedStaff', emailLower));
          if (staffSnap.exists()) {
            const staffData = staffSnap.data() as { active?: boolean; displayName?: string };
            if (staffData.active === false) {
              await signOut(auth);
              setLoginError(
                `Akun (${currentUser.email}) sedang dinonaktifkan oleh Administrator Kecamatan Tarik.`,
              );
              setAccessGranted(false);
              return false;
            }
            staffDisplayName = (staffData.displayName || '').trim();
          } else if (isGoogleProvider) {
            await signOut(auth);
            setLoginError(
              `Akun Google (${currentUser.email}) belum terdaftar oleh Administrator Kecamatan Tarik. Hubungi Admin untuk mendaftarkan email Anda.`,
            );
            setAccessGranted(false);
            return false;
          }
        } catch (err) {
          if (isGoogleProvider) {
            await signOut(auth);
            setLoginError(
              'Gagal memverifikasi status pendaftaran akun. Pastikan akun Anda telah didaftarkan oleh Administrator.',
            );
            setAccessGranted(false);
            return false;
          }
          handleFirestoreError(err, OperationType.GET, staffPath);
        }
      }

      const profilePath = `users/${currentUser.uid}`;
      const profileRef = doc(db, 'users', currentUser.uid);
      try {
        const snap = await getDoc(profileRef);
        const safeName = (
          staffDisplayName ||
          currentUser.displayName ||
          currentUser.email ||
          'Staf Kecamatan'
        ).slice(0, 120);
        const safeEmail = (currentUser.email || 'staff@kecamatantarik.go.id').slice(0, 180);
        const safePhoto = (currentUser.photoURL || '').slice(0, 500);

        if (!snap.exists()) {
          await setDoc(profileRef, {
            uid: currentUser.uid,
            displayName: safeName,
            email: safeEmail,
            photoURL: safePhoto,
            instansi: 'Pemerintah Kecamatan Tarik',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfileName(safeName);
          setProfileInstansi('Pemerintah Kecamatan Tarik');
        } else {
          const existingProfile = snap.data() as {
            displayName?: string;
            instansi?: string;
          };
          const resolvedName = (existingProfile.displayName || safeName).slice(0, 120);
          const resolvedInstansi = (
            existingProfile.instansi || 'Pemerintah Kecamatan Tarik'
          ).slice(0, 160);
          setProfileName(resolvedName);
          setProfileInstansi(resolvedInstansi);
          await updateDoc(profileRef, {
            displayName: resolvedName,
            email: safeEmail,
            photoURL: safePhoto,
            updatedAt: serverTimestamp(),
          });
        }
        setAccessGranted(true);
        setLoginError(null);
        setLoginNotice(null);
        return true;
      } catch (err) {
        setAccessGranted(false);
        handleFirestoreError(err, OperationType.WRITE, profilePath);
        return false;
      }
    } finally {
      setIsCheckingAccess(false);
      setAuthReady(true);
    }
  }, []);

  // Sync Firebase Auth state, enforce admin-provisioned access, and ensure UserProfile document exists
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        const hasTempAdmin =
          typeof window !== 'undefined' &&
          sessionStorage.getItem(TEMP_ADMIN_STORAGE_KEY) === '1';
        if (hasTempAdmin) {
          setIsTempAdmin(true);
          setAccessGranted(true);
          setNeedsEmailVerification(false);
          setIsCheckingAccess(false);
          setAuthReady(true);
          setProfileName('Administrator SILAPER');
          setProfileInstansi('Pemerintah Kecamatan Tarik');
          setSavedReports(readLocalReports());
          return;
        }

        setIsTempAdmin(false);
        setAccessGranted(false);
        setNeedsEmailVerification(false);
        setIsCheckingAccess(false);
        setAuthReady(true);
        setSavedReports([]);
        setStaffList([]);
        setActiveReportId(null);
        setActiveReportOriginalStatus(null);
        setProfileName('Staf Kecamatan');
        setProfileInstansi('Pemerintah Kecamatan Tarik');
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TEMP_ADMIN_STORAGE_KEY);
      }
      setIsTempAdmin(false);
      await verifyAccessAndSyncProfile(currentUser);
    });

    return () => unsubscribe();
  }, [verifyAccessAndSyncProfile]);

  // Attach real-time Firestore listener ONLY when authReady && user && accessGranted
  useEffect(() => {
    if (!authReady || !user || !accessGranted || isTempAdmin) return;

    setLoadingReports(true);
    const reportsPath = `users/${user.uid}/reports`;
    const q = query(
      collection(db, 'users', user.uid, 'reports'),
      where('ownerId', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: StoredTravelReport[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as TravelReportData & {
            ownerId: string;
            createdAt?: { toMillis?: () => number };
            updatedAt?: { toMillis?: () => number };
          };
          return {
            ...data,
            id: docSnap.id,
          };
        });

        items.sort((a, b) => {
          const tA = (a.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          const tB = (b.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          return tB - tA;
        });

        setSavedReports(items);
        setLoadingReports(false);
      },
      (error) => {
        setLoadingReports(false);
        handleFirestoreError(error, OperationType.LIST, reportsPath);
      },
    );

    return () => unsubscribe();
  }, [authReady, user, accessGranted, isTempAdmin]);

  // Attach real-time Firestore listener for Admin's authorizedStaff allowlist
  useEffect(() => {
    if (!authReady || !user || !accessGranted || !isAdminUser || isTempAdmin) return;

    setLoadingStaff(true);
    const staffPath = 'authorizedStaff';
    const q = query(
      collection(db, 'authorizedStaff'),
      where('addedBy', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: AuthorizedStaff[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<AuthorizedStaff, 'id'>;
          return {
            ...data,
            id: docSnap.id,
          };
        });
        rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setStaffList(rows);
        setLoadingStaff(false);
      },
      (error) => {
        setLoadingStaff(false);
        handleFirestoreError(error, OperationType.LIST, staffPath);
      },
    );

    return () => unsubscribe();
  }, [authReady, user, accessGranted, isAdminUser, isTempAdmin]);

  const handleLoginWithEmail = async (email: string, password: string) => {
    setLoginError(null);
    setLoginNotice(null);

    if (email.trim().toLowerCase() === 'admin' && password === 'admin') {
      try {
        sessionStorage.setItem(TEMP_ADMIN_STORAGE_KEY, '1');
      } catch {
        // Ignore storage error
      }
      setIsTempAdmin(true);
      setNeedsEmailVerification(false);
      setAccessGranted(true);
      setAuthReady(true);
      setProfileName('Administrator SILAPER');
      setProfileInstansi('Pemerintah Kecamatan Tarik');
      setSavedReports(readLocalReports());
      showToast('success', 'Masuk dengan akses penuh sementara (Admin).');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    setLoginError(null);
    setLoginNotice(null);
    setIsAuthSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setLoginError(msg);
      showToast('error', msg);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    setLoginError(null);
    setLoginNotice(null);
    setIsAuthSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setLoginNotice(
        `Tautan atur ulang kata sandi telah dikirim ke ${email.trim()}. Periksa kotak masuk atau folder spam email Anda.`,
      );
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setLoginError(null);
    setLoginNotice(null);
    setIsAuthSubmitting(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setLoginNotice(
        `Email verifikasi telah dikirim ke ${auth.currentUser.email}. Silakan klik tautan pada email lalu tekan tombol konfirmasi.`,
      );
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setLoginError(null);
    setLoginNotice(null);
    setIsAuthSubmitting(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      if (!auth.currentUser.emailVerified) {
        setLoginError(
          'Email Anda belum terverifikasi. Pastikan Anda sudah mengklik tautan verifikasi pada kotak masuk email.',
        );
        return;
      }
      const verifiedUser = auth.currentUser;
      setUser(verifiedUser);
      const ok = await verifyAccessAndSyncProfile(verifiedUser);
      if (ok) {
        showToast('success', 'Verifikasi email berhasil. Selamat datang di SILAPER.');
      }
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TEMP_ADMIN_STORAGE_KEY);
      }
      setIsTempAdmin(false);
      setAccessGranted(false);
      if (auth.currentUser) {
        await signOut(auth);
      }
      setActiveTab('editor');
      setLoginError(null);
      setLoginNotice(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal keluar.';
      showToast('error', msg);
    }
  };

  const handleAddAuthorizedStaff = async (input: {
    email: string;
    displayName: string;
    jabatan: string;
    nip: string;
  }): Promise<boolean> => {
    if (!isAdminUser) return false;
    const cleanEmail = input.email.trim().toLowerCase().slice(0, STAFF_FIELD_LIMITS.email);
    const cleanName = input.displayName.trim().slice(0, STAFF_FIELD_LIMITS.displayName);
    const cleanJabatan = input.jabatan.trim().slice(0, STAFF_FIELD_LIMITS.jabatan);
    const cleanNip = input.nip.trim().slice(0, STAFF_FIELD_LIMITS.nip);

    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      showToast('error', 'Format email staf tidak valid.');
      return false;
    }

    if (!user && isTempAdmin) {
      setStaffList((prev) => {
        const filtered = prev.filter((item) => item.id !== cleanEmail);
        const next: AuthorizedStaff[] = [
          ...filtered,
          {
            id: cleanEmail,
            email: cleanEmail,
            displayName: cleanName,
            jabatan: cleanJabatan,
            nip: cleanNip,
            active: true,
            addedBy: 'temp-admin',
          },
        ];
        next.sort((a, b) => a.displayName.localeCompare(b.displayName));
        return next;
      });
      showToast(
        'success',
        `Staf ${cleanEmail} ditambahkan di sesi sementara. Untuk simpan permanen ke database, masuk dengan akun Google Admin.`,
      );
      return true;
    }

    if (!user) return false;
    const staffPath = `authorizedStaff/${cleanEmail}`;
    try {
      await setDoc(doc(db, 'authorizedStaff', cleanEmail), {
        email: cleanEmail,
        displayName: cleanName,
        jabatan: cleanJabatan,
        nip: cleanNip,
        active: true,
        addedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('success', `Akun staf ${cleanEmail} berhasil didaftarkan.`);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, staffPath);
      return false;
    }
  };

  const handleToggleStaffActive = async (staff: AuthorizedStaff) => {
    if (!isAdminUser) return;
    if (!user && isTempAdmin) {
      setStaffList((prev) =>
        prev.map((item) =>
          item.id === staff.id ? { ...item, active: !item.active } : item,
        ),
      );
      showToast(
        'success',
        !staff.active
          ? `Akun ${staff.email} diaktifkan kembali (sesi sementara).`
          : `Akun ${staff.email} dinonaktifkan (sesi sementara).`,
      );
      return;
    }
    if (!user) return;
    const staffPath = `authorizedStaff/${staff.id}`;
    try {
      await updateDoc(doc(db, 'authorizedStaff', staff.id), {
        active: !staff.active,
        updatedAt: serverTimestamp(),
      });
      showToast(
        'success',
        !staff.active
          ? `Akun ${staff.email} diaktifkan kembali.`
          : `Akun ${staff.email} dinonaktifkan.`,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, staffPath);
    }
  };

  const handleDeleteAuthorizedStaff = async (staffId: string) => {
    if (!isAdminUser) return;
    if (!user && isTempAdmin) {
      setStaffList((prev) => prev.filter((item) => item.id !== staffId));
      showToast('success', `Akun ${staffId} dihapus dari daftar sesi sementara.`);
      return;
    }
    if (!user) return;
    const staffPath = `authorizedStaff/${staffId}`;
    try {
      await deleteDoc(doc(db, 'authorizedStaff', staffId));
      showToast('success', `Akun ${staffId} dihapus dari daftar staf terdaftar.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, staffPath);
    }
  };

  const handleOpenEditProfile = () => {
    setProfileMenuOpen(false);
    setDraftProfileName(profileName);
    setDraftProfileInstansi(profileInstansi);
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftProfileName.trim().slice(0, 120);
    const cleanInstansi = draftProfileInstansi.trim().slice(0, 160);

    if (!cleanName) {
      showToast('error', 'Nama pengguna wajib diisi.');
      return;
    }

    setIsSavingProfile(true);
    try {
      if (user) {
        const profilePath = `users/${user.uid}`;
        const profileRef = doc(db, 'users', user.uid);
        try {
          await updateDoc(profileRef, {
            displayName: cleanName,
            instansi: cleanInstansi || 'Pemerintah Kecamatan',
            updatedAt: serverTimestamp(),
          });
          await updateProfile(user, { displayName: cleanName });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, profilePath);
        }
      }

      setProfileName(cleanName);
      setProfileInstansi(cleanInstansi || 'Pemerintah Kecamatan');
      setEditProfileOpen(false);
      showToast('success', 'Profil pengguna berhasil diperbarui.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFieldChange = <K extends keyof TravelReportData>(
    field: K,
    value: TravelReportData[K],
  ) => {
    setReport((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyExtractedSpt = (
    extracted: Partial<TravelReportData>,
    _sourceFileName: string,
  ) => {
    setReport((prev) => ({
      ...prev,
      namaKabupaten: extracted.namaKabupaten || prev.namaKabupaten,
      namaKecamatan: extracted.namaKecamatan || prev.namaKecamatan,
      alamatKecamatan: extracted.alamatKecamatan || prev.alamatKecamatan,
      nomorSpt: extracted.nomorSpt || prev.nomorSpt,
      tanggalSpt: extracted.tanggalSpt || prev.tanggalSpt,
      dasarHukum: extracted.dasarHukum || prev.dasarHukum,
      namaPegawai: extracted.namaPegawai || prev.namaPegawai,
      nip: extracted.nip || prev.nip,
      pangkatGolongan: extracted.pangkatGolongan || prev.pangkatGolongan,
      jabatan: extracted.jabatan || prev.jabatan,
      tujuan: extracted.tujuan || prev.tujuan,
      maksudPerjalanan: extracted.maksudPerjalanan || prev.maksudPerjalanan,
      tanggalBerangkat: extracted.tanggalBerangkat || extracted.tanggalSpt || prev.tanggalBerangkat,
      tanggalKembali: extracted.tanggalKembali || extracted.tanggalSpt || prev.tanggalKembali,
      tempatLaporan: extracted.tempatLaporan || prev.tempatLaporan,
      namaCamat: extracted.namaCamat || prev.namaCamat,
      nipCamat: extracted.nipCamat || prev.nipCamat,
      pangkatCamat: extracted.pangkatCamat || prev.pangkatCamat,
    }));
    // Default locked status after extraction to prevent accidental edits
    setIsUnlocked(false);
  };

  const handleFillDemoData = () => {
    setReport({
      ...SAMPLE_FULL_REPORT,
      photos: SAMPLE_FULL_REPORT.photos.map((p) => ({ ...p })),
    });
    setIsUnlocked(false);
    setShowRequiredErrors(false);
    setActiveReportId(null);
    setActiveReportOriginalStatus(null);
    showToast('success', 'Contoh Data Cepat berhasil dimuat (kolom terkunci otomatis).');
  };

  const handleResetReport = () => {
    setReport(createEmptyReport());
    setIsUnlocked(false);
    setShowRequiredErrors(false);
    setActiveReportId(null);
    setActiveReportOriginalStatus(null);
    showToast('success', 'Formulir laporan dikosongkan untuk entri baru.');
  };

  const handleSaveToArchive = async () => {
    if (!validateRequiredReportSections()) return;

    if (!report.nomorSpt.trim() || !report.namaPegawai.trim()) {
      showToast(
        'error',
        'Nomor SPT dan Nama Pegawai wajib terisi sebelum menyimpan ke arsip.',
      );
      return;
    }

    if (!user && isTempAdmin) {
      const sanitizedLocal = sanitizeReportForFirestore(
        { ...report, status: 'draft' },
        'temp-admin',
      );
      const targetId =
        activeReportId ||
        `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entry: StoredTravelReport = {
        ...sanitizedLocal,
        id: targetId,
      };
      setSavedReports((prev) => {
        const next = [entry, ...prev.filter((r) => r.id !== targetId)];
        writeLocalReports(next);
        return next;
      });
      setActiveReportId(targetId);
      setActiveReportOriginalStatus('draft');
      showToast(
        'success',
        activeReportId
          ? 'Perubahan laporan diperbarui di arsip lokal sesi Admin.'
          : 'Laporan baru tersimpan di arsip lokal sesi Admin.',
      );
      return;
    }

    if (!user) {
      await handleSignIn();
      return;
    }

    setIsSaving(true);
    try {
      const sanitized = sanitizeReportForFirestore(
        { ...report, status: 'draft' },
        user.uid,
      );

      if (activeReportId) {
        const docPath = `users/${user.uid}/reports/${activeReportId}`;
        const docRef = doc(db, 'users', user.uid, 'reports', activeReportId);
        try {
          if (activeReportOriginalStatus === 'final') {
            await updateDoc(docRef, {
              status: 'draft',
              updatedAt: serverTimestamp(),
            });
            setActiveReportOriginalStatus('draft');
          }
          const { ownerId: _ignoredOwner, ...updatableFields } = sanitized;
          await updateDoc(docRef, {
            ...updatableFields,
            updatedAt: serverTimestamp(),
          });
          showToast('success', 'Perubahan laporan berhasil disimpan ke arsip rahasia.');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
      } else {
        const newId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const docPath = `users/${user.uid}/reports/${newId}`;
        const docRef = doc(db, 'users', user.uid, 'reports', newId);
        try {
          await setDoc(docRef, {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setActiveReportId(newId);
          setActiveReportOriginalStatus('draft');
          showToast('success', 'Laporan baru tersimpan aman pada Arsip Tersimpan.');
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromArchive = (stored: StoredTravelReport) => {
    const { id, ownerId: _owner, createdAt: _c, updatedAt: _u, ...data } = stored;
    setReport({
      ...data,
      photos: (data.photos || []).map((p) => ({ ...p })),
    });
    setActiveReportId(id);
    setActiveReportOriginalStatus(stored.status);
    setIsUnlocked(false);
    setActiveTab('editor');
    showToast('success', `Laporan SPT ${stored.nomorSpt} dimuat ke Editor.`);
  };

  const handleToggleArchiveStatus = async (stored: StoredTravelReport) => {
    const nextStatus: StoredTravelReport['status'] =
      stored.status === 'final' ? 'draft' : 'final';
    if (!user && isTempAdmin) {
      setSavedReports((prev) => {
        const next = prev.map((item) =>
          item.id === stored.id ? { ...item, status: nextStatus } : item,
        );
        writeLocalReports(next);
        return next;
      });
      if (activeReportId === stored.id) {
        setActiveReportOriginalStatus(nextStatus);
        setReport((prev) => ({ ...prev, status: nextStatus }));
      }
      showToast(
        'success',
        nextStatus === 'final'
          ? `Laporan ${stored.nomorSpt} ditandai Final.`
          : `Laporan ${stored.nomorSpt} dibuka kembali sebagai Draf.`,
      );
      return;
    }

    if (!user) return;
    const docPath = `users/${user.uid}/reports/${stored.id}`;
    const docRef = doc(db, 'users', user.uid, 'reports', stored.id);
    try {
      await updateDoc(docRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (activeReportId === stored.id) {
        setActiveReportOriginalStatus(nextStatus);
        setReport((prev) => ({ ...prev, status: nextStatus }));
      }
      showToast(
        'success',
        nextStatus === 'final'
          ? `Laporan ${stored.nomorSpt} ditandai Final.`
          : `Laporan ${stored.nomorSpt} dibuka kembali sebagai Draf.`,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  };

  const handleDeleteArchive = async (reportId: string) => {
    if (!user && isTempAdmin) {
      setSavedReports((prev) => {
        const next = prev.filter((item) => item.id !== reportId);
        writeLocalReports(next);
        return next;
      });
      if (activeReportId === reportId) {
        setActiveReportId(null);
        setActiveReportOriginalStatus(null);
      }
      showToast('success', 'Laporan berhasil dihapus dari arsip lokal.');
      return;
    }

    if (!user) return;
    const docPath = `users/${user.uid}/reports/${reportId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'reports', reportId));
      if (activeReportId === reportId) {
        setActiveReportId(null);
        setActiveReportOriginalStatus(null);
      }
      showToast('success', 'Laporan berhasil dihapus dari arsip.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  };

  const handleExportDocx = async () => {
    if (!validateRequiredReportSections()) return;

    setIsExportingDocx(true);
    try {
      await exportReportToDocx(report);
      showToast('success', 'Dokumen Word (.DOCX) berhasil diunduh.');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal mengekspor ke Word (.DOCX).',
      );
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    if (!validateRequiredReportSections()) return;

    setIsExportingPdf(true);
    try {
      await exportReportToPdf(report);
      showToast('success', 'Dokumen PDF (.PDF) berhasil diunduh.');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal mengekspor ke PDF (.PDF).',
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!validateRequiredReportSections()) return;

    if (activeTab !== 'editor') {
      setActiveTab('editor');
      setTimeout(() => window.print(), 150);
      return;
    }
    window.print();
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'editor',
      label: 'Editor Laporan',
      icon: <FilePenLine className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'archive',
      label: 'Arsip Tersimpan',
      icon: <Archive className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'guide',
      label: 'Panduan SPT',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
    ...(isAdminUser
      ? [
          {
            id: 'staff' as ActiveTab,
            label: 'Kelola Akun Staf',
            icon: <UserCheck className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  if (!isTempAdmin && (!authReady || isCheckingAccess)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F6F9] text-[#0F172A] px-6">
        <div className="flex items-center gap-3 mb-4">
          <img
            src="/assets/aistudio/image_08502736.png"
            alt="Logo Resmi Kabupaten Sidoarjo"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="w-10 h-10 object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-[#0F2A56] font-display">
            SILAPER
          </span>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-[#475569]">
          <Loader2 className="w-4 h-4 animate-spin text-[#0F2A56]" />
          <span>Memeriksa sesi autentikasi staf...</span>
        </div>
      </div>
    );
  }

  if (!isTempAdmin && (!user || !accessGranted || needsEmailVerification)) {
    return (
      <LoginPage
        onLoginWithEmail={handleLoginWithEmail}
        onLoginWithGoogle={handleSignIn}
        onResetPassword={handleResetPassword}
        onResendVerification={handleResendVerification}
        onCheckVerification={handleCheckVerification}
        onCancelVerification={handleSignOut}
        needsEmailVerification={needsEmailVerification}
        pendingUserEmail={user?.email || ''}
        authError={loginError}
        authNotice={loginNotice}
        isSubmitting={isAuthSubmitting}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F6F9] text-[#0F172A]">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="no-print lg:hidden fixed inset-0 z-30 bg-slate-900/50"
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-[252px] shrink-0 bg-[#0F2A56] text-white border-r border-[#1E3A8A]/40 flex flex-col justify-between transition-all duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${desktopSidebarOpen ? 'lg:translate-x-0' : 'lg:hidden'}`}
      >
        <div>
          {/* Brand Logo + System Title + Three-line Toggle on Right of SILAPER */}
          <div className="px-5 h-16 flex items-center gap-3 border-b border-white/10">
            <button
              type="button"
              onClick={() => handleSelectTab('editor')}
              className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
            >
              <img
                src="/assets/aistudio/image_08502736.png"
                alt="Logo Resmi Kabupaten Sidoarjo"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                className="w-9 h-9 object-contain shrink-0"
              />
              <span>SILAPER</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen(false);
                setDesktopSidebarOpen(false);
              }}
              aria-label="Sembunyikan sidebar"
              className="p-1.5 rounded-md text-slate-200 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Navigation Links */}
          <nav aria-label="Menu Utama" className="px-3 py-5 space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#0F2A56] font-semibold'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'archive' && (user || isTempAdmin) && savedReports.length > 0 && (
                    <span
                      className={`text-xs tabular-nums ${
                        isActive ? 'text-[#0F2A56]' : 'text-slate-300'
                      }`}
                    >
                      {savedReports.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Auth Zone */}
        <div className="p-4 border-t border-white/10">
          <div className="space-y-3">
            <div className="px-1">
              <p className="text-xs font-semibold text-white truncate">
                {profileName}
              </p>
              {(user?.email || isTempAdmin) && (
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  {user?.email || 'Akses Sementara (admin)'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0F2A56] bg-white rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Menubar (Always visible: Brand/Toggle on left, User Name + Silhouette Photo on far right) */}
        <header className="no-print sticky top-0 z-20 bg-[#0F2A56] text-white border-b border-[#1E3A8A]/40 px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex items-center gap-3 ${
                desktopSidebarOpen ? 'lg:hidden' : 'lg:flex'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectTab('editor')}
                className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
              >
                <img
                  src="/assets/aistudio/image_08502736.png"
                  alt="Logo Resmi Kabupaten Sidoarjo"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-8 h-8 object-contain shrink-0"
                />
                <span>SILAPER</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth >= 1024) {
                    setDesktopSidebarOpen(true);
                  } else {
                    setMobileSidebarOpen((prev) => !prev);
                  }
                }}
                aria-label="Tampilkan sidebar"
                className="p-2 rounded-md text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {desktopSidebarOpen && (
              <span className="hidden lg:inline text-sm font-medium text-slate-200 truncate">
                {activeTab === 'editor'
                  ? 'Editor Laporan Perjalanan Dinas'
                  : activeTab === 'archive'
                    ? 'Arsip Tersimpan'
                    : activeTab === 'staff'
                      ? 'Kelola Akun Staf'
                      : 'Panduan SPT'}
              </span>
            )}
          </div>

          {/* Right End of Menubar: User Name on Left + Silhouette Profile Photo + Small Pop-up Menu */}
          <div ref={profileMenuRef} className="relative flex items-center gap-3 shrink-0">
            <span className="text-xs sm:text-sm font-medium text-white truncate max-w-[140px] sm:max-w-[220px]">
              {profileName}
            </span>

            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Menu profil pengguna"
              className="w-9 h-9 rounded-full bg-white/15 border border-white/30 flex items-center justify-center hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors shrink-0"
            >
              <UserRound className="w-5 h-5 text-white" />
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                aria-label="Opsi profil"
                className="absolute right-0 top-full mt-2 w-52 bg-white text-[#0F172A] border border-[#D8E0EB] rounded-lg shadow-lg py-1.5 z-50"
              >
                <div className="px-3.5 py-2 border-b border-[#E2E8F0]">
                  <p className="text-xs font-semibold text-[#0F172A] truncate">
                    {profileName}
                  </p>
                  <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                    {user?.email || profileInstansi}
                  </p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenEditProfile}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9] transition-colors text-left"
                >
                  <UserPen className="w-3.5 h-3.5 text-[#0F2A56]" />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Action Toolbar */}
        {activeTab === 'editor' && (
          <div className="no-print bg-white border-b border-[#D8E0EB]">
            <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[#475569]">
                <span className="font-semibold text-[#0F172A]">
                  Sistem Laporan Perjalanan Dinas Kecamatan Tarik
                </span>
                {activeReportId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[#0F2A56] font-medium">
                      Arsip Aktif: {report.nomorSpt || activeReportId}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col items-stretch lg:items-end gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillDemoData}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded-md hover:bg-[#DBEAFE] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Contoh Data Cepat
                  </button>

                  <button
                    type="button"
                    onClick={handleResetReport}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveToArchive}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2A56] bg-white border border-[#0F2A56] rounded-md hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5" />
                    )}
                    {activeReportId ? 'Perbarui Arsip' : 'Simpan ke Arsip'}
                  </button>

                  <button
                    type="button"
                    disabled={isExportingDocx}
                    onClick={handleExportDocx}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] rounded-md hover:bg-[#172554] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    {isExportingDocx ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    Unduh ke Word (.DOCX)
                  </button>

                  <button
                    type="button"
                    disabled={isExportingPdf}
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#0A1E40] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    {isExportingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    Unduh ke PDF (.PDF)
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] border border-[#CBD5E1] rounded-md hover:bg-[#E2E8F0] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak / Print
                  </button>
                </div>

                <div
                  role="note"
                  className="inline-flex items-center gap-2 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#0F2A56]"
                >
                  <Info className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                  <span>
                    Catatan: Proses ekstraksi &amp; penyusunan laporan akan dimulai secara otomatis begitu file PDF SPT diunggah.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {toast && (
          <div className="no-print w-full px-6 pt-3">
            <div
              role="status"
              className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-xs font-medium ${
                toast.type === 'success'
                  ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]'
                  : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1">
          {activeTab === 'editor' && (
            <div className="px-6 py-6 flex flex-col xl:flex-row items-start gap-6">
              {/* Left Column: Input Form */}
              <div className="no-print w-full xl:w-[44%] shrink-0">
                <ReportForm
                  report={report}
                  isUnlocked={isUnlocked}
                  showRequiredErrors={showRequiredErrors}
                  onToggleUnlock={() => setIsUnlocked((prev) => !prev)}
                  onChangeField={handleFieldChange}
                  onApplyExtractedSpt={handleApplyExtractedSpt}
                />
              </div>

              {/* Right Column: Official A4 Document Live Preview */}
              <div className="w-full xl:w-[56%]">
                <div className="no-print flex items-center justify-between mb-3 px-1">
                  <div className="text-xs font-semibold text-[#334155]">
                    Live Preview Dokumen Resmi (Kertas A4)
                  </div>
                  <div className="text-xs text-[#64748B]">
                    2 Halaman · Kop Surat Kecamatan + Lampiran Dokumentasi ({report.photos.length}/4)
                  </div>
                </div>

                <div className="a4-sheet-wrapper bg-[#E2E8F0] border border-[#CBD5E1] rounded-lg p-4 md:p-6 xl:max-h-[calc(100vh-190px)] xl:overflow-y-auto print:bg-white print:border-none print:p-0 print:max-h-none print:overflow-visible">
                  <A4Preview report={report} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <ArchivePanel
              user={user}
              authReady={authReady || isTempAdmin}
              isTempAdmin={isTempAdmin}
              reports={savedReports}
              loadingReports={loadingReports}
              activeReportId={activeReportId}
              onSignIn={handleSignIn}
              onLoadReport={handleLoadFromArchive}
              onToggleReportStatus={handleToggleArchiveStatus}
              onDeleteReport={handleDeleteArchive}
              onCreateNewReport={() => {
                handleResetReport();
                setActiveTab('editor');
              }}
            />
          )}

          {activeTab === 'guide' && <GuidePanel />}

          {activeTab === 'staff' && isAdminUser && (
            <StaffAdminPanel
              staffList={staffList}
              loadingStaff={loadingStaff}
              adminEmail={ADMIN_EMAIL}
              onAddStaff={handleAddAuthorizedStaff}
              onToggleStaffActive={handleToggleStaffActive}
              onDeleteStaff={handleDeleteAuthorizedStaff}
            />
          )}
        </main>
      </div>

      {/* Pop-up Validasi Wajib Diisi */}
      {validationModalOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="validation-modal-title"
          aria-describedby="validation-modal-desc"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md bg-white border border-[#D8E0EB] rounded-lg p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626] shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2
                  id="validation-modal-title"
                  className="text-base font-semibold text-[#0F172A]"
                >
                  Data Laporan Belum Lengkap
                </h2>
                <div id="validation-modal-desc" className="mt-1.5 space-y-1.5">
                  {validationMessages.map((msg, index) => (
                    <p
                      key={index}
                      className="text-sm font-medium text-[#991B1B] leading-relaxed"
                    >
                      {msg}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-[#475569] mt-2 leading-relaxed">
                  Lengkapi seluruh kolom wajib bertanda bintang merah (*) terlebih dahulu sebelum menyimpan, mengunduh, atau mencetak dokumen resmi.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setValidationModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleFocusRequiredField}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors whitespace-nowrap"
              >
                {!report.hasilPelaksanaan.trim() || !report.kesimpulanSaran.trim()
                  ? isUnlocked
                    ? 'Lengkapi Kolom Sekarang'
                    : 'Buka Kunci & Lengkapi'
                  : 'Unggah Foto Dokumentasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Profile */}
      {editProfileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md bg-white border border-[#D8E0EB] rounded-lg p-6 shadow-xl">
            <h2
              id="edit-profile-title"
              className="text-base font-semibold text-[#0F172A]"
            >
              Edit Profile Pengguna
            </h2>
            <p className="text-xs text-[#475569] mt-1">
              Sesuaikan nama tampilan staf dan unit instansi kecamatan Anda.
            </p>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="editProfileName"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  Nama Pengguna
                </label>
                <input
                  id="editProfileName"
                  type="text"
                  required
                  maxLength={120}
                  value={draftProfileName}
                  onChange={(e) => setDraftProfileName(e.target.value)}
                  placeholder="Nama lengkap staf"
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="editProfileInstansi"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  Instansi / Unit Kecamatan
                </label>
                <input
                  id="editProfileInstansi"
                  type="text"
                  maxLength={160}
                  value={draftProfileInstansi}
                  onChange={(e) => setDraftProfileInstansi(e.target.value)}
                  placeholder="Contoh: Kecamatan Cisarua"
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              {user?.email && (
                <div className="text-xs text-[#64748B] pt-1">
                  Email akun terverifikasi: <span className="font-medium text-[#334155]">{user.email}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {isSavingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
