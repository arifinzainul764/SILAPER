import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileText,
  Home,
  Loader2,
  LogOut,
  Menu,
  Printer,
  RotateCcw,
  Send,
  UserCheck,
  UserPen,
  UserRound,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { A4Preview } from './components/A4Preview';
import { AccountPanel } from './components/AccountPanel';
import { ArchivePanel } from './components/ArchivePanel';
import { GuidePanel } from './components/GuidePanel';
import { HomePanel } from './components/HomePanel';
import { LoginPage } from './components/LoginPage';
import {
  ReportForm,
  SptAttachmentPayload,
  SuratDasarAttachmentPayload,
} from './components/ReportForm';
import { EditStaffInput, StaffAdminPanel } from './components/StaffAdminPanel';
import { deleteSuratDasarPdf } from './lib/suratDasarStorage';
import { exportReportToDocx } from './lib/exportDocx';
import { exportReportToPdf } from './lib/exportPdf';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
} from './lib/firebase';
import {
  generateSaltHex,
  hashStaffPassword,
  normalizeNipKey,
  readActiveStaffSession,
  readLocalStaffRegistry,
  verifyStaffPassword,
  writeActiveStaffSession,
  writeLocalStaffRegistry,
} from './lib/staffAuth';
import {
  ADMIN_EMAIL,
  AuthorizedStaff,
  ReportStatus,
  STAFF_FIELD_LIMITS,
  StoredTravelReport,
  TravelReportData,
  createEmptyReport,
  normalizeReportStatus,
  sanitizeReportForFirestore,
} from './types/report';

type ActiveTab = 'home' | 'editor' | 'archive' | 'guide' | 'staff' | 'account';

const TEMP_ADMIN_STORAGE_KEY = 'silaper_temp_admin';
const TEMP_OPERATOR_STORAGE_KEY = 'silaper_temp_operator';
const LOCAL_REPORTS_STORAGE_KEY = 'silaper_local_reports';
const OPERATOR_OVERRIDES_STORAGE_KEY = 'silaper_operator_fb_overrides';

interface OperatorStatusOverride {
  status: ReportStatus;
  catatanVerifikasi?: string;
}

function getReportStorageKey(staffNipKey?: string): string {
  return staffNipKey ? `silaper_local_reports_${staffNipKey}` : LOCAL_REPORTS_STORAGE_KEY;
}

function readLocalReports(staffNipKey?: string): StoredTravelReport[] {
  try {
    const raw = localStorage.getItem(getReportStorageKey(staffNipKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as StoredTravelReport[]).map((item) => ({
      ...item,
      status: normalizeReportStatus(item.status),
    }));
  } catch {
    return [];
  }
}

function readScopedUserReports(staffNipKey: string): StoredTravelReport[] {
  return readLocalReports(staffNipKey).filter(
    (item) => !item.ownerId || item.ownerId === staffNipKey,
  );
}

function writeLocalReports(reports: StoredTravelReport[], staffNipKey?: string) {
  try {
    localStorage.setItem(getReportStorageKey(staffNipKey), JSON.stringify(reports));
  } catch {
    // Ignore storage quota errors
  }
}

function readOperatorOverrides(): Record<string, OperatorStatusOverride> {
  try {
    const raw = localStorage.getItem(OPERATOR_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, OperatorStatusOverride>)
      : {};
  } catch {
    return {};
  }
}

function writeOperatorOverrides(map: Record<string, OperatorStatusOverride>) {
  try {
    localStorage.setItem(OPERATOR_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

function getAllLocalReportKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (
        key &&
        (key === LOCAL_REPORTS_STORAGE_KEY || key.startsWith('silaper_local_reports_'))
      ) {
        keys.push(key);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return keys;
}

function readAllLocalReports(): StoredTravelReport[] {
  const byId = new Map<string, StoredTravelReport>();
  const overrides = readOperatorOverrides();

  for (const key of getAllLocalReportKeys()) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed as StoredTravelReport[]) {
        if (!item?.id) continue;
        const override = overrides[item.id];
        byId.set(item.id, {
          ...item,
          status: normalizeReportStatus(override ? override.status : item.status),
          catatanVerifikasi:
            override && override.catatanVerifikasi !== undefined
              ? override.catatanVerifikasi
              : item.catatanVerifikasi || '',
        });
      }
    } catch {
      // Ignore malformed bucket
    }
  }

  return Array.from(byId.values());
}

function updateReportInLocalBuckets(
  reportId: string,
  updater: (item: StoredTravelReport) => StoredTravelReport,
): boolean {
  let updated = false;

  for (const key of getAllLocalReportKeys()) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const list = parsed as StoredTravelReport[];
      if (!list.some((item) => item.id === reportId)) continue;

      const nextList = list.map((item) => {
        if (item.id !== reportId) return item;
        updated = true;
        const nextItem = updater(item);
        if (key.startsWith('silaper_local_reports_fb_')) {
          const overrides = readOperatorOverrides();
          overrides[reportId] = {
            status: normalizeReportStatus(nextItem.status),
            catatanVerifikasi: nextItem.catatanVerifikasi || '',
          };
          writeOperatorOverrides(overrides);
        }
        return nextItem;
      });
      localStorage.setItem(key, JSON.stringify(nextList));
    } catch {
      // Ignore malformed bucket
    }
  }

  return updated;
}

function deleteReportFromLocalBuckets(reportId: string): boolean {
  let deleted = false;
  for (const key of getAllLocalReportKeys()) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const list = parsed as StoredTravelReport[];
      const nextList = list.filter((item) => item.id !== reportId);
      if (nextList.length !== list.length) {
        deleted = true;
        localStorage.setItem(key, JSON.stringify(nextList));
      }
    } catch {
      // Ignore malformed bucket
    }
  }
  return deleted;
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
    default:
      return err instanceof Error ? err.message : 'Gagal melakukan autentikasi.';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState<boolean>(true);
  const [mobileToolbarExpanded, setMobileToolbarExpanded] = useState<boolean>(false);
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
  const [isOperator, setIsOperator] = useState<boolean>(() => {
    try {
      return (
        typeof window !== 'undefined' && sessionStorage.getItem(TEMP_OPERATOR_STORAGE_KEY) === '1'
      );
    } catch {
      return false;
    }
  });
  const [localStaff, setLocalStaff] = useState<AuthorizedStaff | null>(() =>
    typeof window !== 'undefined' ? readActiveStaffSession() : null,
  );
  const hasLocalSession = isTempAdmin || isOperator || Boolean(localStaff);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(false);
  const [accessGranted, setAccessGranted] = useState<boolean>(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        (sessionStorage.getItem(TEMP_ADMIN_STORAGE_KEY) === '1' ||
          sessionStorage.getItem(TEMP_OPERATOR_STORAGE_KEY) === '1' ||
          Boolean(readActiveStaffSession()))
      );
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
  const [activeReportOriginalStatus, setActiveReportOriginalStatus] = useState<ReportStatus | null>(null);
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
  const [formSessionKey, setFormSessionKey] = useState<number>(0);

  // User Profile & Menubar Pop-up Menu states
  const [profileName, setProfileName] = useState<string>('Staf Kecamatan');
  const [profileInstansi, setProfileInstansi] = useState<string>('Pemerintah Kecamatan');
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Live Preview Zoom states (35% - 175%) with automatic fit-to-width on wide/responsive screens
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [isAutoFitZoom, setIsAutoFitZoom] = useState<boolean>(true);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const actionToolbarRef = useRef<HTMLDivElement>(null);
  const [actionToolbarHeight, setActionToolbarHeight] = useState<number>(60);

  useEffect(() => {
    const toolbarEl = actionToolbarRef.current;
    if (!toolbarEl || activeTab !== 'editor') return;

    const updateToolbarHeight = () => {
      setActionToolbarHeight(toolbarEl.offsetHeight || 60);
    };

    updateToolbarHeight();
    const observer = new ResizeObserver(updateToolbarHeight);
    observer.observe(toolbarEl);
    return () => observer.disconnect();
  }, [activeTab, accessGranted, hasLocalSession, desktopSidebarOpen, activeReportId]);

  const computeAutoFitZoom = useCallback(() => {
    const wrapper = previewWrapperRef.current;
    const content = previewContentRef.current;
    if (!wrapper || !content || content.offsetWidth === 0) return;
    const wrapperStyle = window.getComputedStyle(wrapper);
    const padX =
      (parseFloat(wrapperStyle.paddingLeft) || 0) +
      (parseFloat(wrapperStyle.paddingRight) || 0);
    const availableWidth = Math.max(240, wrapper.clientWidth - padX - 8);
    const fitted = Math.min(1.2, Math.max(0.35, availableWidth / content.offsetWidth));
    setPreviewZoom(Math.round(fitted * 100) / 100);
  }, []);

  useEffect(() => {
    const el = previewContentRef.current;
    const wrapper = previewWrapperRef.current;
    if (!el || activeTab !== 'editor') return;

    const updateSize = () => {
      setPreviewSize({
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
      if (isAutoFitZoom) {
        computeAutoFitZoom();
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    if (wrapper) {
      observer.observe(wrapper);
    }
    return () => observer.disconnect();
  }, [
    activeTab,
    accessGranted,
    hasLocalSession,
    isAutoFitZoom,
    desktopSidebarOpen,
    computeAutoFitZoom,
    report.photos.length,
    report.dasarHukum,
  ]);

  const handleZoomOut = () => {
    setIsAutoFitZoom(false);
    setPreviewZoom((prev) => Math.max(0.35, Math.round((prev - 0.1) * 100) / 100));
  };

  const handleZoomIn = () => {
    setIsAutoFitZoom(false);
    setPreviewZoom((prev) => Math.min(1.75, Math.round((prev + 0.1) * 100) / 100));
  };

  const handleResetZoom = () => {
    setIsAutoFitZoom(false);
    setPreviewZoom(1);
  };

  const handleFitPreviewWidth = () => {
    setIsAutoFitZoom(true);
    computeAutoFitZoom();
  };

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
      messages.push('03. Foto Dokumentasi Kegiatan wajib di isi');
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

  const canManageStaff = isAdminUser || isOperator;
  const canVerifyReports = isAdminUser || isOperator;
  const isRegularUser = !isAdminUser && !isOperator && (Boolean(localStaff) || Boolean(user));
  const currentOwnerId = localStaff
    ? localStaff.nipKey
    : user
      ? user.uid
      : isOperator
        ? 'operator'
        : isTempAdmin
          ? 'temp-admin'
          : '';
  const accountRoleLabel: 'User' | 'Operator' | 'Administrator' = isAdminUser
    ? 'Administrator'
    : isOperator
      ? 'Operator'
      : 'User';

  const resetEditorWorkspace = useCallback(() => {
    setReport(createEmptyReport());
    setActiveReportId(null);
    setActiveReportOriginalStatus(null);
    setIsUnlocked(false);
    setShowRequiredErrors(false);
    setValidationModalOpen(false);
    setFormSessionKey((prev) => prev + 1);
  }, []);

  const verifyAccessAndSyncProfile = useCallback(async (currentUser: User): Promise<boolean> => {
    setIsCheckingAccess(true);
    try {
      const emailLower = (currentUser.email || '').trim().toLowerCase();

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

        const staffPath = 'authorizedStaff';
        try {
          const staffQuery = query(
            collection(db, 'authorizedStaff'),
            where('email', '==', emailLower),
          );
          const staffSnap = await getDocs(staffQuery);
          if (!staffSnap.empty) {
            const activeStaffDoc =
              staffSnap.docs.find((d) => (d.data() as { active?: boolean }).active !== false) ||
              staffSnap.docs[0];
            const staffData = activeStaffDoc.data() as { active?: boolean; displayName?: string };
            if (staffData.active === false) {
              await signOut(auth);
              setLoginError(
                `Akun (${currentUser.email}) sedang dinonaktifkan oleh Administrator Kecamatan Tarik.`,
              );
              setAccessGranted(false);
              return false;
            }
            staffDisplayName = (staffData.displayName || '').trim();
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, staffPath);
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
        const hasTempOperator =
          typeof window !== 'undefined' &&
          sessionStorage.getItem(TEMP_OPERATOR_STORAGE_KEY) === '1';
        if (hasTempOperator) {
          setIsOperator(true);
          setIsTempAdmin(false);
          setLocalStaff(null);
          setAccessGranted(true);
          setNeedsEmailVerification(false);
          setIsCheckingAccess(false);
          setAuthReady(true);
          setProfileName('Operator SILAPER');
          setProfileInstansi('Pemerintah Kecamatan Tarik');
          setSavedReports(readAllLocalReports());
          return;
        }

        const hasTempAdmin =
          typeof window !== 'undefined' &&
          sessionStorage.getItem(TEMP_ADMIN_STORAGE_KEY) === '1';
        if (hasTempAdmin) {
          setIsOperator(false);
          setIsTempAdmin(true);
          setLocalStaff(null);
          setAccessGranted(true);
          setNeedsEmailVerification(false);
          setIsCheckingAccess(false);
          setAuthReady(true);
          setProfileName('Administrator SILAPER');
          setProfileInstansi('Pemerintah Kecamatan Tarik');
          setSavedReports(readAllLocalReports());
          return;
        }

        const savedStaffSession = readActiveStaffSession();
        if (savedStaffSession) {
          setIsOperator(false);
          setIsTempAdmin(false);
          setLocalStaff(savedStaffSession);
          setAccessGranted(true);
          setNeedsEmailVerification(false);
          setIsCheckingAccess(false);
          setAuthReady(true);
          setProfileName(savedStaffSession.displayName);
          setProfileInstansi(savedStaffSession.jabatan || 'Pemerintah Kecamatan Tarik');
          setSavedReports(readScopedUserReports(savedStaffSession.nipKey));
          return;
        }

        setIsOperator(false);
        setIsTempAdmin(false);
        setLocalStaff(null);
        setAccessGranted(false);
        setNeedsEmailVerification(false);
        setIsCheckingAccess(false);
        setAuthReady(true);
        setSavedReports([]);
        setStaffList([]);
        resetEditorWorkspace();
        setProfileName('Staf Kecamatan');
        setProfileInstansi('Pemerintah Kecamatan Tarik');
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TEMP_ADMIN_STORAGE_KEY);
        sessionStorage.removeItem(TEMP_OPERATOR_STORAGE_KEY);
      }
      writeActiveStaffSession(null);
      setIsOperator(false);
      setIsTempAdmin(false);
      setLocalStaff(null);
      await verifyAccessAndSyncProfile(currentUser);
    });

    return () => unsubscribe();
  }, [verifyAccessAndSyncProfile, resetEditorWorkspace]);

  // Attach real-time Firestore listener ONLY when authReady && user && accessGranted
  useEffect(() => {
    if (!authReady || !user || !accessGranted || hasLocalSession) return;

    setLoadingReports(true);
    const reportsPath = isAdminUser ? 'reports' : `users/${user.uid}/reports`;
    const q = isAdminUser
      ? query(collectionGroup(db, 'reports'), where('ownerId', '!=', ''))
      : query(collection(db, 'users', user.uid, 'reports'), where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const overrides = readOperatorOverrides();
        let overridesDirty = false;

        const items: StoredTravelReport[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as TravelReportData & {
            ownerId: string;
            createdAt?: { toMillis?: () => number };
            updatedAt?: { toMillis?: () => number };
          };
          const pendingOverride = overrides[docSnap.id];
          if (!isAdminUser && pendingOverride && data.ownerId === user.uid) {
            delete overrides[docSnap.id];
            overridesDirty = true;
            void updateDoc(doc(db, 'users', user.uid, 'reports', docSnap.id), {
              status: pendingOverride.status,
              catatanVerifikasi: pendingOverride.catatanVerifikasi || '',
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          return {
            ...data,
            status: normalizeReportStatus(pendingOverride ? pendingOverride.status : data.status),
            catatanVerifikasi:
              pendingOverride && pendingOverride.catatanVerifikasi !== undefined
                ? pendingOverride.catatanVerifikasi
                : data.catatanVerifikasi || '',
            id: docSnap.id,
          };
        });

        if (overridesDirty) {
          writeOperatorOverrides(overrides);
        }

        items.sort((a, b) => {
          const tA = (a.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          const tB = (b.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          return tB - tA;
        });

        if (!isAdminUser) {
          try {
            localStorage.setItem(`silaper_local_reports_fb_${user.uid}`, JSON.stringify(items));
          } catch {
            // Ignore storage quota errors
          }
        }

        setSavedReports(items);
        setLoadingReports(false);
      },
      (error) => {
        setLoadingReports(false);
        handleFirestoreError(error, OperationType.LIST, reportsPath);
      },
    );

    return () => unsubscribe();
  }, [authReady, user, accessGranted, hasLocalSession, isAdminUser]);

  // Attach real-time Firestore listener for Admin's authorizedStaff allowlist (or local registry in temp-admin/operator mode)
  useEffect(() => {
    if ((isTempAdmin || isOperator) && !user && accessGranted) {
      const localRows = readLocalStaffRegistry();
      localRows.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setStaffList(localRows);
      setLoadingStaff(false);
      return;
    }

    if (!authReady || !user || !accessGranted || !isAdminUser || hasLocalSession) return;

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
        writeLocalStaffRegistry(rows);
        setLoadingStaff(false);
      },
      (error) => {
        setLoadingStaff(false);
        handleFirestoreError(error, OperationType.LIST, staffPath);
      },
    );

    return () => unsubscribe();
  }, [authReady, user, accessGranted, isAdminUser, isTempAdmin, isOperator, hasLocalSession]);

  const handleLoginWithEmail = async (identifier: string, password: string) => {
    setLoginError(null);
    setLoginNotice(null);

    const cleanIdentifier = identifier.trim();
    if (cleanIdentifier.toLowerCase() === 'admin' && password === 'admin') {
      try {
        sessionStorage.setItem(TEMP_ADMIN_STORAGE_KEY, '1');
        sessionStorage.removeItem(TEMP_OPERATOR_STORAGE_KEY);
      } catch {
        // Ignore storage error
      }
      writeActiveStaffSession(null);
      resetEditorWorkspace();
      setLocalStaff(null);
      setIsOperator(false);
      setIsTempAdmin(true);
      setNeedsEmailVerification(false);
      setAccessGranted(true);
      setAuthReady(true);
      setProfileName('Administrator SILAPER');
      setProfileInstansi('Pemerintah Kecamatan Tarik');
      setSavedReports(readAllLocalReports());
      const localRows = readLocalStaffRegistry();
      localRows.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setStaffList(localRows);
      setActiveTab('home');
      showToast('success', 'Masuk dengan akses penuh sementara (Admin).');
      return;
    }

    if (cleanIdentifier.toLowerCase() === 'operator' && password === 'operator') {
      try {
        sessionStorage.setItem(TEMP_OPERATOR_STORAGE_KEY, '1');
        sessionStorage.removeItem(TEMP_ADMIN_STORAGE_KEY);
      } catch {
        // Ignore storage error
      }
      writeActiveStaffSession(null);
      resetEditorWorkspace();
      setLocalStaff(null);
      setIsTempAdmin(false);
      setIsOperator(true);
      setNeedsEmailVerification(false);
      setAccessGranted(true);
      setAuthReady(true);
      setProfileName('Operator SILAPER');
      setProfileInstansi('Pemerintah Kecamatan Tarik');
      setSavedReports(readAllLocalReports());
      const localRows = readLocalStaffRegistry();
      localRows.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setStaffList(localRows);
      setActiveTab('home');
      showToast('success', 'Masuk sebagai Operator Verifikator SPD SILAPER.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const normalizedInputNip = normalizeNipKey(cleanIdentifier);
      const emailCandidate = cleanIdentifier.toLowerCase();
      const registry = readLocalStaffRegistry();
      const matchedStaff = registry.find(
        (item) =>
          (normalizedInputNip && item.nipKey === normalizedInputNip) ||
          (emailCandidate.includes('@') && item.email && item.email.toLowerCase() === emailCandidate),
      );

      if (matchedStaff) {
        if (!matchedStaff.active) {
          setLoginError(
            `Akun user ${matchedStaff.displayName} (NIP. ${matchedStaff.nip}) sedang dinonaktifkan oleh Administrator.`,
          );
          return;
        }
        const passwordValid = await verifyStaffPassword(
          password,
          matchedStaff.passwordSalt,
          matchedStaff.passwordHash,
        );
        if (!passwordValid) {
          setLoginError('Password akun tidak sesuai.');
          return;
        }

        try {
          sessionStorage.removeItem(TEMP_ADMIN_STORAGE_KEY);
          sessionStorage.removeItem(TEMP_OPERATOR_STORAGE_KEY);
        } catch {
          // Ignore storage error
        }
        writeActiveStaffSession(matchedStaff);
        resetEditorWorkspace();
        setIsOperator(false);
        setIsTempAdmin(false);
        setLocalStaff(matchedStaff);
        setNeedsEmailVerification(false);
        setAccessGranted(true);
        setAuthReady(true);
        setProfileName(matchedStaff.displayName);
        setProfileInstansi(matchedStaff.jabatan || 'Pemerintah Kecamatan Tarik');
        setSavedReports(readScopedUserReports(matchedStaff.nipKey));
        setActiveTab('home');
        showToast('success', `Selamat datang, ${matchedStaff.displayName}.`);
        return;
      }

      if (!cleanIdentifier.includes('@')) {
        setLoginError('NIP staf belum terdaftar oleh Administrator atau kata sandi tidak sesuai.');
        return;
      }

      await signInWithEmailAndPassword(auth, cleanIdentifier, password);
      setActiveTab('home');
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
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
        sessionStorage.removeItem(TEMP_OPERATOR_STORAGE_KEY);
      }
      writeActiveStaffSession(null);
      resetEditorWorkspace();
      setSavedReports([]);
      setStaffList([]);
      setIsOperator(false);
      setIsTempAdmin(false);
      setLocalStaff(null);
      setAccessGranted(false);
      if (auth.currentUser) {
        await signOut(auth);
      }
      setActiveTab('home');
      setLoginError(null);
      setLoginNotice(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal keluar.';
      showToast('error', msg);
    }
  };

  const handleAddAuthorizedStaff = async (input: {
    nip: string;
    displayName: string;
    jabatan: string;
    password: string;
    email: string;
  }): Promise<boolean> => {
    if (!canManageStaff) return false;
    const cleanNip = input.nip.trim().slice(0, STAFF_FIELD_LIMITS.nip);
    const nipKey = normalizeNipKey(cleanNip).slice(0, STAFF_FIELD_LIMITS.nipKey);
    const cleanName = input.displayName.trim().slice(0, STAFF_FIELD_LIMITS.displayName);
    const cleanJabatan = input.jabatan.trim().slice(0, STAFF_FIELD_LIMITS.jabatan);
    const cleanEmail = input.email.trim().toLowerCase().slice(0, STAFF_FIELD_LIMITS.email);

    if (!cleanNip || !nipKey) {
      showToast('error', 'NIP wajib diisi dengan karakter huruf atau angka yang valid.');
      return false;
    }
    if (!cleanName || !cleanJabatan) {
      showToast('error', 'Nama Lengkap dan Jabatan wajib diisi.');
      return false;
    }
    if (
      !input.password ||
      input.password.length < STAFF_FIELD_LIMITS.passwordMin ||
      input.password.length > STAFF_FIELD_LIMITS.passwordMax
    ) {
      showToast(
        'error',
        `Password wajib diisi minimal ${STAFF_FIELD_LIMITS.passwordMin} karakter.`,
      );
      return false;
    }
    if (cleanEmail) {
      const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        showToast('error', 'Format email staf tidak valid.');
        return false;
      }
    }

    if (staffList.some((item) => item.id === nipKey || item.nipKey === nipKey)) {
      showToast('error', `Akun dengan NIP ${cleanNip} sudah terdaftar.`);
      return false;
    }

    const passwordSalt = generateSaltHex();
    const passwordHash = await hashStaffPassword(input.password, passwordSalt);

    const newStaffEntry: AuthorizedStaff = {
      id: nipKey,
      nip: cleanNip,
      nipKey,
      displayName: cleanName,
      jabatan: cleanJabatan,
      passwordSalt,
      passwordHash,
      email: cleanEmail,
      active: true,
      addedBy: user ? user.uid : isOperator ? 'operator' : 'temp-admin',
    };

    if (!user && (isTempAdmin || isOperator)) {
      setStaffList((prev) => {
        const filtered = prev.filter((item) => item.id !== nipKey);
        const next: AuthorizedStaff[] = [...filtered, newStaffEntry];
        next.sort((a, b) => a.displayName.localeCompare(b.displayName));
        writeLocalStaffRegistry(next);
        return next;
      });
      showToast(
        'success',
        `Akun staf ${cleanName} (NIP. ${cleanNip}) berhasil didaftarkan.`,
      );
      return true;
    }

    if (!user) return false;
    const staffPath = `authorizedStaff/${nipKey}`;
    try {
      await setDoc(doc(db, 'authorizedStaff', nipKey), {
        nip: cleanNip,
        nipKey,
        displayName: cleanName,
        jabatan: cleanJabatan,
        passwordSalt,
        passwordHash,
        email: cleanEmail,
        active: true,
        addedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const merged = [...readLocalStaffRegistry().filter((item) => item.id !== nipKey), newStaffEntry];
      writeLocalStaffRegistry(merged);
      showToast('success', `Akun staf ${cleanName} (NIP. ${cleanNip}) berhasil didaftarkan.`);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, staffPath);
      return false;
    }
  };

  const handleEditAuthorizedStaff = async (input: EditStaffInput): Promise<boolean> => {
    if (!canManageStaff) return false;
    const existing = staffList.find((item) => item.id === input.id);
    if (!existing) {
      showToast('error', 'Data akun staf yang akan diubah tidak ditemukan.');
      return false;
    }

    const cleanNip = input.nip.trim().slice(0, STAFF_FIELD_LIMITS.nip);
    const newNipKey = normalizeNipKey(cleanNip).slice(0, STAFF_FIELD_LIMITS.nipKey);
    const cleanName = input.displayName.trim().slice(0, STAFF_FIELD_LIMITS.displayName);
    const cleanJabatan = input.jabatan.trim().slice(0, STAFF_FIELD_LIMITS.jabatan);
    const cleanEmail = input.email.trim().toLowerCase().slice(0, STAFF_FIELD_LIMITS.email);

    if (!cleanNip || !newNipKey) {
      showToast('error', 'NIP wajib diisi dengan karakter huruf atau angka yang valid.');
      return false;
    }
    if (!cleanName || !cleanJabatan) {
      showToast('error', 'Nama Lengkap dan Jabatan wajib diisi.');
      return false;
    }
    if (
      input.password &&
      (input.password.length < STAFF_FIELD_LIMITS.passwordMin ||
        input.password.length > STAFF_FIELD_LIMITS.passwordMax)
    ) {
      showToast(
        'error',
        `Password baru minimal terdiri dari ${STAFF_FIELD_LIMITS.passwordMin} karakter.`,
      );
      return false;
    }
    if (cleanEmail) {
      const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        showToast('error', 'Format email staf tidak valid.');
        return false;
      }
    }

    if (
      newNipKey !== existing.id &&
      staffList.some(
        (item) => item.id !== existing.id && (item.id === newNipKey || item.nipKey === newNipKey),
      )
    ) {
      showToast('error', `Akun dengan NIP ${cleanNip} sudah terdaftar pada akun lain.`);
      return false;
    }

    let passwordSalt = existing.passwordSalt;
    let passwordHash = existing.passwordHash;
    if (input.password) {
      passwordSalt = generateSaltHex();
      passwordHash = await hashStaffPassword(input.password, passwordSalt);
    }

    const updatedEntry: AuthorizedStaff = {
      ...existing,
      id: newNipKey,
      nip: cleanNip,
      nipKey: newNipKey,
      displayName: cleanName,
      jabatan: cleanJabatan,
      email: cleanEmail,
      passwordSalt,
      passwordHash,
    };

    if (!user && (isTempAdmin || isOperator)) {
      setStaffList((prev) => {
        const next = prev.map((item) => (item.id === existing.id ? updatedEntry : item));
        next.sort((a, b) => a.displayName.localeCompare(b.displayName));
        writeLocalStaffRegistry(next);
        return next;
      });
      showToast(
        'success',
        `Data akun staf ${cleanName} (NIP. ${cleanNip}) berhasil diperbarui.`,
      );
      return true;
    }

    if (!user) return false;
    if (newNipKey === existing.id) {
      const staffPath = `authorizedStaff/${existing.id}`;
      try {
        await updateDoc(doc(db, 'authorizedStaff', existing.id), {
          nip: cleanNip,
          displayName: cleanName,
          jabatan: cleanJabatan,
          email: cleanEmail,
          ...(input.password ? { passwordSalt, passwordHash } : {}),
          updatedAt: serverTimestamp(),
        });
        const merged = readLocalStaffRegistry().map((item) =>
          item.id === existing.id ? updatedEntry : item,
        );
        writeLocalStaffRegistry(merged);
        showToast(
          'success',
          `Data akun staf ${cleanName} (NIP. ${cleanNip}) berhasil diperbarui.`,
        );
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, staffPath);
        return false;
      }
    }

    // NIP key changed: create new document and remove old one
    const newStaffPath = `authorizedStaff/${newNipKey}`;
    try {
      await setDoc(doc(db, 'authorizedStaff', newNipKey), {
        nip: cleanNip,
        nipKey: newNipKey,
        displayName: cleanName,
        jabatan: cleanJabatan,
        passwordSalt,
        passwordHash,
        email: cleanEmail,
        active: existing.active,
        addedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'authorizedStaff', existing.id));
      const merged = [
        ...readLocalStaffRegistry().filter((item) => item.id !== existing.id && item.id !== newNipKey),
        updatedEntry,
      ];
      writeLocalStaffRegistry(merged);
      showToast(
        'success',
        `Data akun staf ${cleanName} (NIP. ${cleanNip}) berhasil diperbarui.`,
      );
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, newStaffPath);
      return false;
    }
  };

  const handleToggleStaffActive = async (staff: AuthorizedStaff) => {
    if (!canManageStaff) return;
    if (!user && (isTempAdmin || isOperator)) {
      setStaffList((prev) => {
        const next = prev.map((item) =>
          item.id === staff.id ? { ...item, active: !item.active } : item,
        );
        writeLocalStaffRegistry(next);
        return next;
      });
      showToast(
        'success',
        !staff.active
          ? `Akun ${staff.displayName} (NIP. ${staff.nip}) diaktifkan kembali.`
          : `Akun ${staff.displayName} (NIP. ${staff.nip}) dinonaktifkan.`,
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
          ? `Akun ${staff.displayName} (NIP. ${staff.nip}) diaktifkan kembali.`
          : `Akun ${staff.displayName} (NIP. ${staff.nip}) dinonaktifkan.`,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, staffPath);
    }
  };

  const handleDeleteAuthorizedStaff = async (staffId: string) => {
    if (!canManageStaff) return;
    if (!user && (isTempAdmin || isOperator)) {
      setStaffList((prev) => {
        const next = prev.filter((item) => item.id !== staffId);
        writeLocalStaffRegistry(next);
        return next;
      });
      showToast('success', `Akun staf ${staffId} berhasil dihapus.`);
      return;
    }
    if (!user) return;
    const staffPath = `authorizedStaff/${staffId}`;
    try {
      await deleteDoc(doc(db, 'authorizedStaff', staffId));
      const nextLocal = readLocalStaffRegistry().filter((item) => item.id !== staffId);
      writeLocalStaffRegistry(nextLocal);
      showToast('success', `Akun staf ${staffId} dihapus dari daftar staf terdaftar.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, staffPath);
    }
  };

  const handleOpenAccount = () => {
    setProfileMenuOpen(false);
    setActiveTab('account');
  };

  const handleSaveOwnAccountProfile = async (input: {
    displayName: string;
    instansi: string;
    email?: string;
  }): Promise<boolean> => {
    const cleanName = input.displayName.trim().slice(0, STAFF_FIELD_LIMITS.displayName);
    const cleanInstansi = input.instansi.trim().slice(0, STAFF_FIELD_LIMITS.jabatan);
    const cleanEmail = (input.email ?? '').trim().toLowerCase().slice(0, STAFF_FIELD_LIMITS.email);

    if (!cleanName) {
      showToast('error', 'Nama lengkap wajib diisi.');
      return false;
    }

    if (user) {
      const profilePath = `users/${user.uid}`;
      const profileRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(profileRef, {
          displayName: cleanName,
          instansi: cleanInstansi || 'Pemerintah Kecamatan Tarik',
          updatedAt: serverTimestamp(),
        });
        await updateProfile(user, { displayName: cleanName });
        setProfileName(cleanName);
        setProfileInstansi(cleanInstansi || 'Pemerintah Kecamatan Tarik');
        showToast('success', 'Profil akun berhasil diperbarui.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, profilePath);
        return false;
      }
    }

    if (localStaff) {
      const updatedStaff: AuthorizedStaff = {
        ...localStaff,
        displayName: cleanName,
        jabatan: cleanInstansi || localStaff.jabatan,
        email: input.email !== undefined ? cleanEmail : localStaff.email,
      };
      const existingRegistry = readLocalStaffRegistry();
      const foundInRegistry = existingRegistry.some((item) => item.id === localStaff.id || item.nipKey === localStaff.nipKey);
      const nextRegistry = foundInRegistry
        ? existingRegistry.map((item) =>
            item.id === localStaff.id || item.nipKey === localStaff.nipKey ? updatedStaff : item,
          )
        : [...existingRegistry, updatedStaff];
      nextRegistry.sort((a, b) => a.displayName.localeCompare(b.displayName));
      writeLocalStaffRegistry(nextRegistry);
      writeActiveStaffSession(updatedStaff);
      setLocalStaff(updatedStaff);
      setStaffList(nextRegistry);
      setProfileName(cleanName);
      setProfileInstansi(updatedStaff.jabatan || 'Pemerintah Kecamatan Tarik');
      showToast('success', 'Data akun Anda berhasil diperbarui.');
      return true;
    }

    setProfileName(cleanName);
    setProfileInstansi(cleanInstansi || 'Pemerintah Kecamatan Tarik');
    showToast('success', 'Profil tampilan berhasil diperbarui.');
    return true;
  };

  const handleChangeOwnStaffPassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!localStaff) {
      return { ok: false, error: 'Akun aktif tidak mendukung perubahan kata sandi lokal.' };
    }

    const validCurrent = await verifyStaffPassword(
      currentPassword,
      localStaff.passwordSalt,
      localStaff.passwordHash,
    );
    if (!validCurrent) {
      return { ok: false, error: 'Kata sandi saat ini tidak sesuai.' };
    }

    const newSalt = generateSaltHex();
    const newHash = await hashStaffPassword(newPassword, newSalt);
    const updatedStaff: AuthorizedStaff = {
      ...localStaff,
      passwordSalt: newSalt,
      passwordHash: newHash,
    };

    const existingRegistry = readLocalStaffRegistry();
    const nextRegistry = existingRegistry.some((item) => item.id === localStaff.id || item.nipKey === localStaff.nipKey)
      ? existingRegistry.map((item) =>
          item.id === localStaff.id || item.nipKey === localStaff.nipKey ? updatedStaff : item,
        )
      : [...existingRegistry, updatedStaff];

    writeLocalStaffRegistry(nextRegistry);
    writeActiveStaffSession(updatedStaff);
    setLocalStaff(updatedStaff);
    setStaffList(nextRegistry);
    showToast('success', 'Kata sandi akun berhasil diperbarui.');
    return { ok: true };
  };

  const handleSendOwnPasswordReset = async (
    email: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast('success', `Tautan atur ulang kata sandi telah dikirim ke ${email.trim()}.`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: mapFirebaseAuthError(err) };
    }
  };

  const handleFieldChange = <K extends keyof TravelReportData>(
    field: K,
    value: TravelReportData[K],
  ) => {
    setReport((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'namaKabupaten' ||
      field === 'namaKecamatan' ||
      field === 'alamatKecamatan'
        ? { kopBannerDataUrl: '' }
        : {}),
    }));
  };

  const clampMaxOneA4Line = (rawText?: string, maxChars = 74): string => {
    const cleaned = (rawText || '').replace(/\r\n/g, '\n').trim();
    if (!cleaned) return '';
    const firstLine = (
      cleaned
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean) || cleaned
    )
      .replace(/^\d+\.\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const boundaryMatch = firstLine.match(/[a-z]{3,}[.!?](?=\s+[A-Z])/);
    const singleSentence =
      boundaryMatch && boundaryMatch.index !== undefined
        ? firstLine.slice(0, boundaryMatch.index + boundaryMatch[0].length).trim()
        : firstLine;

    if (singleSentence.length <= maxChars) {
      return singleSentence;
    }

    const slice = singleSentence.slice(0, maxChars - 1);
    const lastSpace = slice.lastIndexOf(' ');
    const trimmed = (lastSpace > 25 ? slice.slice(0, lastSpace) : slice)
      .replace(/[,;:\s]+$/, '')
      .trim();
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  };

  const handleApplyExtractedSpt = (
    extracted: Partial<TravelReportData>,
    _sourceFileName: string,
  ) => {
    setReport((prev) => {
      const resolvedTujuan = (extracted.tujuan || prev.tujuan || '').split(',')[0].trim();
      const candidateHasil = resolvedTujuan
        ? `Kegiatan di ${resolvedTujuan} telah dilaksanakan dengan tertib dan lancar.`
        : '';
      const fallbackHasil =
        candidateHasil && candidateHasil.length <= 74
          ? candidateHasil
          : 'Kegiatan perjalanan dinas sesuai SPT telah dilaksanakan dengan lancar.';

      const candidateKesimpulan = resolvedTujuan
        ? `Pelaksanaan tugas di ${resolvedTujuan} berjalan sesuai rencana dan tertib.`
        : '';
      const fallbackKesimpulan =
        candidateKesimpulan && candidateKesimpulan.length <= 74
          ? candidateKesimpulan
          : 'Pelaksanaan tugas berjalan sesuai rencana dan agar segera ditindaklanjuti.';

      const generatedHasil = clampMaxOneA4Line(extracted.hasilPelaksanaan) || fallbackHasil;
      const generatedKesimpulan =
        clampMaxOneA4Line(extracted.kesimpulanSaran) || fallbackKesimpulan;

      return {
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
        hasilPelaksanaan: generatedHasil,
        kesimpulanSaran: generatedKesimpulan,
        tempatLaporan: extracted.tempatLaporan || prev.tempatLaporan,
        namaCamat: extracted.namaCamat || prev.namaCamat,
        nipCamat: extracted.nipCamat || prev.nipCamat,
        pangkatCamat: extracted.pangkatCamat || prev.pangkatCamat,
        logoDataUrl: typeof extracted.logoDataUrl === 'string' ? extracted.logoDataUrl : '',
        kopBannerDataUrl:
          typeof extracted.kopBannerDataUrl === 'string' ? extracted.kopBannerDataUrl : '',
      };
    });
    setShowRequiredErrors(false);
    // Default locked status after extraction to prevent accidental edits
    setIsUnlocked(false);
  };

  const handleSaveSptPdf = (attachment: SptAttachmentPayload) => {
    setReport((prev) => ({
      ...prev,
      sptPdfId: attachment.sptPdfId,
      sptPdfName: attachment.sptPdfName,
      sptPdfSize: attachment.sptPdfSize,
      sptPdfDataUrl: attachment.sptPdfDataUrl,
    }));
  };

  const handleSaveSuratDasarPdf = (attachment: SuratDasarAttachmentPayload) => {
    setReport((prev) => ({
      ...prev,
      suratDasarPdfId: attachment.suratDasarPdfId,
      suratDasarPdfName: attachment.suratDasarPdfName,
      suratDasarPdfSize: attachment.suratDasarPdfSize,
      suratDasarPdfDataUrl: attachment.suratDasarPdfDataUrl,
    }));
  };

  const handleClearSuratDasarPdf = () => {
    setReport((prev) => ({
      ...prev,
      suratDasarPdfId: '',
      suratDasarPdfName: '',
      suratDasarPdfSize: 0,
      suratDasarPdfDataUrl: '',
    }));
  };

  const handleResetReport = () => {
    if (
      report.sptPdfId &&
      !savedReports.some((item) => item.sptPdfId === report.sptPdfId)
    ) {
      void deleteSuratDasarPdf(report.sptPdfId, currentOwnerId, canVerifyReports);
    }
    if (
      report.suratDasarPdfId &&
      !savedReports.some((item) => item.suratDasarPdfId === report.suratDasarPdfId)
    ) {
      void deleteSuratDasarPdf(report.suratDasarPdfId, currentOwnerId, canVerifyReports);
    }
    setReport(createEmptyReport());
    setFormSessionKey((prev) => prev + 1);
    setIsUnlocked(false);
    setShowRequiredErrors(false);
    setActiveReportId(null);
    setActiveReportOriginalStatus(null);
    showToast('success', 'Formulir laporan dikosongkan untuk entri baru.');
  };

  const handleStartNewReport = () => {
    setReport(createEmptyReport());
    setFormSessionKey((prev) => prev + 1);
    setIsUnlocked(false);
    setShowRequiredErrors(false);
    setIsAutoFitZoom(true);
    setActiveReportId(null);
    setActiveReportOriginalStatus(null);
    setToast(null);
    setActiveTab('editor');
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

    if (!user && hasLocalSession) {
      const localOwner = localStaff ? localStaff.nipKey : isOperator ? 'operator' : 'temp-admin';
      const storageScope = localStaff ? localStaff.nipKey : isOperator ? 'operator' : undefined;
      const sanitizedLocal = sanitizeReportForFirestore(
        { ...report, status: 'diajukan' },
        localOwner,
      );
      const targetId =
        activeReportId ||
        `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entry: StoredTravelReport = {
        ...sanitizedLocal,
        id: targetId,
      };

      if (canVerifyReports) {
        const updatedExisting =
          Boolean(activeReportId) &&
          updateReportInLocalBuckets(targetId, (prevItem) => ({
            ...entry,
            ownerId: prevItem.ownerId || localOwner,
          }));
        if (!updatedExisting) {
          const currentScoped = readLocalReports(storageScope);
          const nextScoped = [entry, ...currentScoped.filter((r) => r.id !== targetId)];
          writeLocalReports(nextScoped, storageScope);
        }
        setSavedReports(readAllLocalReports());
      } else if (localStaff) {
        // Strict per-user isolation: write only within user's own bucket
        const currentScoped = readScopedUserReports(localStaff.nipKey);
        const existingOwn = currentScoped.find((r) => r.id === targetId);
        if (activeReportId && existingOwn && existingOwn.ownerId && existingOwn.ownerId !== localStaff.nipKey) {
          showToast('error', 'Akses ditolak: Anda tidak berwenang mengubah pengajuan User lain.');
          return;
        }
        const nextScoped = [entry, ...currentScoped.filter((r) => r.id !== targetId)];
        writeLocalReports(nextScoped, localStaff.nipKey);
        setSavedReports(nextScoped);
      }

      setActiveReportId(targetId);
      setActiveReportOriginalStatus('diajukan');
      showToast(
        'success',
        activeReportId
          ? 'Perubahan laporan SPD berhasil diajukan pada sesi Anda.'
          : 'Laporan SPD baru berhasil diajukan dan tersimpan pada Daftar SPD Anda.',
      );
      return;
    }

    if (!user) {
      showToast('error', 'Sesi autentikasi berakhir. Silakan masuk kembali menggunakan akun yang dibuat oleh Admin.');
      await handleSignOut();
      return;
    }

    setIsSaving(true);
    try {
      const targetOwnerId =
        (activeReportId &&
          isAdminUser &&
          savedReports.find((r) => r.id === activeReportId)?.ownerId) ||
        user.uid;
      const sanitized = sanitizeReportForFirestore(
        { ...report, status: 'diajukan' },
        targetOwnerId,
      );

      if (activeReportId) {
        const docPath = `users/${targetOwnerId}/reports/${activeReportId}`;
        const docRef = doc(db, 'users', targetOwnerId, 'reports', activeReportId);
        try {
          if (activeReportOriginalStatus === 'diterima') {
            await updateDoc(docRef, {
              status: 'diajukan',
              updatedAt: serverTimestamp(),
            });
            setActiveReportOriginalStatus('diajukan');
          }
          const { ownerId: _ignoredOwner, ...updatableFields } = sanitized;
          await updateDoc(docRef, {
            ...updatableFields,
            updatedAt: serverTimestamp(),
          });
          showToast('success', 'Perubahan laporan SPD berhasil diajukan.');
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
          setActiveReportOriginalStatus('diajukan');
          showToast('success', 'Laporan SPD baru berhasil diajukan dan tersimpan pada Daftar SPD.');
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromArchive = (stored: StoredTravelReport) => {
    if (!canVerifyReports && stored.ownerId && currentOwnerId && stored.ownerId !== currentOwnerId) {
      showToast(
        'error',
        'Akses ditolak: Anda tidak berwenang mengakses file atau pengajuan milik User lain.',
      );
      return;
    }
    const { id, ownerId: _owner, createdAt: _c, updatedAt: _u, ...data } = stored;
    const normalizedStatus = normalizeReportStatus(data.status);
    setReport({
      ...data,
      status: normalizedStatus,
      logoDataUrl: data.logoDataUrl || '',
      kopBannerDataUrl: data.kopBannerDataUrl || '',
      sptPdfId: data.sptPdfId || '',
      sptPdfName: data.sptPdfName || '',
      sptPdfSize: data.sptPdfSize || 0,
      sptPdfDataUrl: data.sptPdfDataUrl || '',
      suratDasarPdfId: data.suratDasarPdfId || '',
      suratDasarPdfName: data.suratDasarPdfName || '',
      suratDasarPdfSize: data.suratDasarPdfSize || 0,
      suratDasarPdfDataUrl: data.suratDasarPdfDataUrl || '',
      catatanVerifikasi: data.catatanVerifikasi || '',
      photos: (data.photos || []).map((p) => ({ ...p })),
    });
    setActiveReportId(id);
    setActiveReportOriginalStatus(normalizedStatus);
    setFormSessionKey((prev) => prev + 1);
    setIsUnlocked(false);
    setShowRequiredErrors(false);
    setActiveTab('editor');
    showToast('success', `Laporan SPT ${stored.nomorSpt} dimuat ke Editor.`);
  };

  const handleChangeArchiveStatus = async (
    stored: StoredTravelReport,
    nextStatus: ReportStatus,
    catatanVerifikasi?: string,
  ) => {
    if (!canVerifyReports) {
      showToast('error', 'Hanya Operator atau Administrator yang dapat memverifikasi dan mengubah status SPD.');
      return;
    }

    const cleanNote =
      catatanVerifikasi !== undefined
        ? catatanVerifikasi.slice(0, 500)
        : stored.catatanVerifikasi || '';

    const statusMessage =
      nextStatus === 'diterima'
        ? `Laporan ${stored.nomorSpt} diverifikasi dan ditandai Diterima.`
        : nextStatus === 'ditolak'
          ? `Laporan ${stored.nomorSpt} ditandai Ditolak.`
          : `Status laporan ${stored.nomorSpt} diubah menjadi Diajukan.`;

    if (!user && hasLocalSession) {
      const updated = updateReportInLocalBuckets(stored.id, (item) => ({
        ...item,
        status: nextStatus,
        catatanVerifikasi: cleanNote,
      }));
      if (!updated) {
        const storageScope = localStaff
          ? localStaff.nipKey
          : isOperator
            ? 'operator'
            : undefined;
        const current = readLocalReports(storageScope);
        writeLocalReports(
          current.map((item) =>
            item.id === stored.id
              ? { ...item, status: nextStatus, catatanVerifikasi: cleanNote }
              : item,
          ),
          storageScope,
        );
      }
      setSavedReports(
        isTempAdmin || isOperator
          ? readAllLocalReports()
          : readLocalReports(localStaff?.nipKey),
      );
      if (activeReportId === stored.id) {
        setActiveReportOriginalStatus(nextStatus);
        setReport((prev) => ({
          ...prev,
          status: nextStatus,
          catatanVerifikasi: cleanNote,
        }));
      }
      showToast('success', statusMessage);
      return;
    }

    if (!user) return;
    const targetOwnerId = stored.ownerId || user.uid;
    const docPath = `users/${targetOwnerId}/reports/${stored.id}`;
    const docRef = doc(db, 'users', targetOwnerId, 'reports', stored.id);
    try {
      await updateDoc(docRef, {
        status: nextStatus,
        catatanVerifikasi: cleanNote,
        updatedAt: serverTimestamp(),
      });
      if (activeReportId === stored.id) {
        setActiveReportOriginalStatus(nextStatus);
        setReport((prev) => ({
          ...prev,
          status: nextStatus,
          catatanVerifikasi: cleanNote,
        }));
      }
      showToast('success', statusMessage);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  };

  const handleDeleteArchive = async (reportId: string) => {
    const targetReport = savedReports.find((item) => item.id === reportId);
    if (!targetReport) {
      showToast('error', 'Data laporan tidak ditemukan pada daftar Anda.');
      return;
    }
    if (
      !canVerifyReports &&
      targetReport.ownerId &&
      currentOwnerId &&
      targetReport.ownerId !== currentOwnerId
    ) {
      showToast(
        'error',
        'Akses ditolak: Anda tidak berwenang menghapus pengajuan atau file milik User lain.',
      );
      return;
    }

    if (targetReport?.sptPdfId) {
      void deleteSuratDasarPdf(targetReport.sptPdfId, currentOwnerId, canVerifyReports);
    }
    if (targetReport?.suratDasarPdfId) {
      void deleteSuratDasarPdf(targetReport.suratDasarPdfId, currentOwnerId, canVerifyReports);
    }

    if (!user && hasLocalSession) {
      if (canVerifyReports) {
        const removed = deleteReportFromLocalBuckets(reportId);
        if (!removed) {
          const storageScope = isOperator ? 'operator' : undefined;
          writeLocalReports(
            readLocalReports(storageScope).filter((item) => item.id !== reportId),
            storageScope,
          );
        }
        setSavedReports(readAllLocalReports());
      } else if (localStaff) {
        // Strict isolation: mutate only user's own bucket
        const nextScoped = readScopedUserReports(localStaff.nipKey).filter(
          (item) => item.id !== reportId,
        );
        writeLocalReports(nextScoped, localStaff.nipKey);
        setSavedReports(nextScoped);
      }

      if (activeReportId === reportId) {
        setActiveReportId(null);
        setActiveReportOriginalStatus(null);
      }
      showToast('success', 'Laporan berhasil dihapus dari arsip.');
      return;
    }

    if (!user) return;
    const targetOwnerId = canVerifyReports ? (targetReport.ownerId || user.uid) : user.uid;
    const docPath = `users/${targetOwnerId}/reports/${reportId}`;
    try {
      await deleteDoc(doc(db, 'users', targetOwnerId, 'reports', reportId));
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
      id: 'home',
      label: 'Beranda',
      icon: <Home className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'archive',
      label: 'Daftar SPD',
      icon: <Archive className="w-4 h-4 shrink-0" />,
    },
    ...(canManageStaff
      ? [
          {
            id: 'staff' as ActiveTab,
            label: 'Kelola Akun Staf',
            icon: <UserCheck className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
    ...(isRegularUser
      ? [
          {
            id: 'account' as ActiveTab,
            label: 'Kelola Akun',
            icon: <UserPen className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
    {
      id: 'guide',
      label: 'Panduan SPT',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
  ];

  if (!hasLocalSession && (!authReady || isCheckingAccess)) {
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

  if (!hasLocalSession && (!user || !accessGranted || needsEmailVerification)) {
    return (
      <LoginPage
        onLoginWithEmail={handleLoginWithEmail}
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
              onClick={() => handleSelectTab('home')}
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
              const isActive =
                activeTab === item.id || (item.id === 'archive' && activeTab === 'editor');
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
                  {item.id === 'archive' && (user || hasLocalSession) && savedReports.length > 0 && (
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
              {(user?.email || isTempAdmin || isOperator || localStaff) && (
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  {user?.email ||
                    (localStaff
                      ? `NIP. ${localStaff.nip} · User`
                      : isOperator
                        ? 'Akses Operator Verifikator'
                        : 'Akses Sementara (admin)')}
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
                onClick={() => handleSelectTab('home')}
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
                {activeTab === 'home'
                  ? 'Beranda'
                  : activeTab === 'editor'
                    ? activeReportId || isOperator
                      ? 'Sunting Laporan Perjalanan Dinas'
                      : 'Buat Laporan/Ajukan SPD Baru'
                    : activeTab === 'archive'
                      ? 'Daftar SPD'
                      : activeTab === 'staff'
                        ? 'Kelola Akun Staf'
                        : activeTab === 'account'
                          ? 'Kelola Akun'
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
                className="absolute right-0 top-full mt-2 w-56 bg-white text-[#0F172A] border border-[#D8E0EB] rounded-lg shadow-lg py-1.5 z-50"
              >
                <div className="px-3.5 py-2 border-b border-[#E2E8F0]">
                  <p className="text-xs font-semibold text-[#0F172A] truncate">
                    {profileName}
                  </p>
                  <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                    {user?.email || (localStaff ? `NIP. ${localStaff.nip} · User` : profileInstansi)}
                  </p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenAccount}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9] transition-colors text-left"
                >
                  <UserPen className="w-3.5 h-3.5 text-[#0F2A56]" />
                  <span>Kelola Akun</span>
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

        {/* Action Toolbar (Frozen on scroll; collapsible on mobile) */}
        {activeTab === 'editor' && (
          <div
            ref={actionToolbarRef}
            className="no-print sticky top-14 z-10 bg-white border-b border-[#D8E0EB] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
          >
            <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-2 md:py-3 flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-2.5 md:gap-3">
              {/* Top Row: Back button + Title (desktop) + Mobile Hide/Show Toggle */}
              <div className="flex items-center justify-between gap-2 w-full md:w-auto">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#475569] min-w-0">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('archive')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#0F2A56] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md hover:bg-[#EFF6FF] hover:border-[#BFDBFE] transition-colors whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Kembali Ke Daftar SPD
                  </button>
                  {activeReportId && (
                    <span className="hidden md:inline font-mono-tabular text-[#0F2A56] font-medium">
                      Arsip Aktif: {report.nomorSpt || activeReportId}
                    </span>
                  )}
                </div>

                {/* Mobile-only Hide / Show Action Buttons Toggle */}
                <button
                  type="button"
                  onClick={() => setMobileToolbarExpanded((prev) => !prev)}
                  aria-expanded={mobileToolbarExpanded}
                  aria-controls="editor-action-buttons-panel"
                  className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded-md hover:bg-[#DBEAFE] transition-colors whitespace-nowrap shrink-0"
                >
                  {mobileToolbarExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Sembunyikan
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Menu Aksi
                    </>
                  )}
                </button>
              </div>

              {/* Collapsible Section on Mobile (always shown on md+) */}
              <div
                id="editor-action-buttons-panel"
                className={`${
                  mobileToolbarExpanded ? 'flex' : 'hidden md:flex'
                } flex-col items-stretch lg:items-end gap-2 pt-1 border-t border-[#E2E8F0] md:pt-0 md:border-t-0`}
              >
                {activeReportId && (
                  <div className="md:hidden font-mono-tabular text-[11px] font-medium text-[#0F2A56]">
                    Arsip Aktif: {report.nomorSpt || activeReportId}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {!isOperator && (
                    <button
                      type="button"
                      onClick={handleResetReport}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  )}

                  {!isOperator && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveToArchive}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2A56] bg-white border border-[#0F2A56] rounded-md hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Ajukan SPD
                    </button>
                  )}

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
          {activeTab === 'home' && (
            <HomePanel
              profileName={profileName}
              profileInstansi={profileInstansi}
              accountSubLabel={
                user?.email ||
                (localStaff
                  ? `NIP. ${localStaff.nip}`
                  : isOperator
                    ? 'Akses Operator Verifikator'
                    : isTempAdmin
                      ? 'Akses Administrator'
                      : undefined)
              }
              reports={savedReports}
              loadingReports={loadingReports}
              isAdminUser={isAdminUser}
              isOperator={isOperator}
              canManageStaff={canManageStaff}
              staffCount={staffList.length}
              onCreateNewReport={handleStartNewReport}
              onOpenReport={handleLoadFromArchive}
              onNavigateTab={(tab) => handleSelectTab(tab)}
            />
          )}

          {activeTab === 'editor' && (
            <div
              style={
                {
                  '--toolbar-sticky-top': `${56 + actionToolbarHeight + 16}px`,
                  '--preview-sticky-max-h': `calc(100vh - ${56 + actionToolbarHeight + 84}px)`,
                } as React.CSSProperties
              }
              className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-5 lg:py-6 grid grid-cols-1 lg:grid-cols-[minmax(360px,43%)_minmax(0,1fr)] xl:grid-cols-[minmax(440px,44%)_minmax(0,1fr)] 2xl:grid-cols-[minmax(520px,620px)_minmax(0,1fr)] items-start gap-5 xl:gap-6 print:block print:p-0"
            >
              {/* Left Column: All Groupboxes Stacked Vertically */}
              <div className="no-print min-w-0 w-full">
                <ReportForm
                  key={formSessionKey}
                  report={report}
                  isUnlocked={isUnlocked}
                  showRequiredErrors={showRequiredErrors}
                  currentOwnerId={currentOwnerId}
                  canAccessAllFiles={canVerifyReports}
                  onToggleUnlock={() => setIsUnlocked((prev) => !prev)}
                  onChangeField={handleFieldChange}
                  onApplyExtractedSpt={handleApplyExtractedSpt}
                  onSaveSptPdf={handleSaveSptPdf}
                  onSaveSuratDasarPdf={handleSaveSuratDasarPdf}
                  onClearSuratDasarPdf={handleClearSuratDasarPdf}
                />
              </div>

              {/* Right Column: Official A4 Document Live Preview (Sticky on Wide Screens) */}
              <div className="min-w-0 w-full lg:sticky lg:top-[var(--toolbar-sticky-top)] print:static print:w-full">
                <div className="no-print flex flex-wrap items-center justify-between gap-2.5 mb-3 px-0.5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#334155]">
                      Live Preview Dokumen Resmi (Kertas A4)
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      2 Halaman · Kop Surat Kecamatan + Lampiran Dokumentasi ({report.photos.length}/4)
                    </div>
                  </div>

                  {/* Zoom Controls */}
                  <div
                    role="group"
                    aria-label="Kontrol zoom pratinjau dokumen"
                    className="inline-flex items-center bg-white border border-[#CBD5E1] rounded-md overflow-hidden shrink-0"
                  >
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={previewZoom <= 0.35}
                      aria-label="Perkecil pratinjau dokumen (Zoom Out)"
                      title="Perkecil (Zoom Out)"
                      className="px-2.5 py-1.5 text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F2A56] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleResetZoom}
                      title="Klik untuk reset zoom ke 100%"
                      aria-label={`Tingkat zoom ${Math.round(previewZoom * 100)} persen, klik untuk reset ke 100%`}
                      className="px-2.5 py-1.5 min-w-[54px] text-center text-xs font-semibold font-mono-tabular text-[#0F172A] border-x border-[#E2E8F0] hover:bg-[#EFF6FF] hover:text-[#0F2A56] transition-colors"
                    >
                      {Math.round(previewZoom * 100)}%
                    </button>

                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={previewZoom >= 1.75}
                      aria-label="Perbesar pratinjau dokumen (Zoom In)"
                      title="Perbesar (Zoom In)"
                      className="px-2.5 py-1.5 text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F2A56] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleFitPreviewWidth}
                      title="Sesuaikan lebar kertas A4 ke panel pratinjau"
                      className={`px-2.5 py-1.5 text-[11px] font-medium border-l border-[#E2E8F0] transition-colors whitespace-nowrap ${
                        isAutoFitZoom
                          ? 'bg-[#EFF6FF] text-[#0F2A56] font-semibold'
                          : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#EFF6FF] hover:text-[#0F2A56]'
                      }`}
                    >
                      Pas Lebar
                    </button>
                  </div>
                </div>

                <div
                  ref={previewWrapperRef}
                  className="a4-sheet-wrapper bg-[#E2E8F0] border border-[#CBD5E1] rounded-lg p-3 sm:p-4 lg:p-5 lg:max-h-[var(--preview-sticky-max-h)] overflow-auto print:bg-white print:border-none print:p-0 print:max-h-none print:overflow-visible"
                >
                  <div
                    className="preview-zoom-box mx-auto"
                    style={{
                      width: previewSize.width ? `${previewSize.width * previewZoom}px` : undefined,
                      height: previewSize.height ? `${previewSize.height * previewZoom}px` : undefined,
                    }}
                  >
                    <div
                      ref={previewContentRef}
                      className="preview-zoom-stage origin-top-left w-fit"
                      style={{ transform: `scale(${previewZoom})` }}
                    >
                      <A4Preview report={report} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <ArchivePanel
              user={user}
              authReady={authReady || hasLocalSession}
              isTempAdmin={isTempAdmin}
              isOperator={isOperator}
              hasLocalSession={hasLocalSession}
              canVerifyReports={canVerifyReports}
              currentOwnerId={currentOwnerId}
              reports={savedReports}
              loadingReports={loadingReports}
              activeReportId={activeReportId}
              onLoadReport={handleLoadFromArchive}
              onChangeReportStatus={handleChangeArchiveStatus}
              onDeleteReport={handleDeleteArchive}
              onCreateNewReport={handleStartNewReport}
            />
          )}

          {activeTab === 'guide' && <GuidePanel />}

          {activeTab === 'account' && (
            <AccountPanel
              roleLabel={accountRoleLabel}
              profileName={profileName}
              profileInstansi={profileInstansi}
              accountEmail={user?.email || localStaff?.email || ''}
              staffNip={localStaff?.nip}
              isLocalStaff={Boolean(localStaff)}
              isFirebaseUser={Boolean(user)}
              onSaveProfile={handleSaveOwnAccountProfile}
              onChangeStaffPassword={localStaff ? handleChangeOwnStaffPassword : undefined}
              onSendPasswordResetEmail={user ? handleSendOwnPasswordReset : undefined}
            />
          )}

          {activeTab === 'staff' && canManageStaff && (
            <StaffAdminPanel
              staffList={staffList}
              loadingStaff={loadingStaff}
              adminEmail={ADMIN_EMAIL}
              managerLabel={
                isOperator
                  ? 'Operator SILAPER'
                  : isTempAdmin
                    ? 'Admin Sementara (admin)'
                    : undefined
              }
              onAddStaff={handleAddAuthorizedStaff}
              onEditStaff={handleEditAuthorizedStaff}
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

    </div>
  );
}
