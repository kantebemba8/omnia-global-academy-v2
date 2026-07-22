import { StudioEvaluations } from './pages/studio/StudioEvaluations';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { RootGate } from './components/RootGate';
import { MaintenancePage } from './pages/MaintenancePage';
import { SiteModeProvider, useSiteMode } from './context/SiteModeContext';
import { LandingPage } from './pages/LandingPage';
import { APropos } from './pages/APropos';
import { Confidentialite } from './pages/Confidentialite';
import LegalDocumentPage from './pages/LegalDocumentPage';
import { Catalogue } from './pages/Catalogue';
import { CoursDetail } from './pages/CoursDetail';
import { ApercuGratuit } from './pages/ApercuGratuit';
import { CoursLecteur } from './pages/CoursLecteur';
import { ExamenModule } from './pages/ExamenModule';
import { ValidationFinale } from './pages/ValidationFinale';
import { SelectRole } from './pages/auth/SelectRole';
import { RegisterApprenant } from './pages/auth/RegisterApprenant';
import { RegisterProfesseur } from './pages/auth/RegisterProfesseur';
import { RegisterOrganizer } from './pages/auth/RegisterOrganizer';
import { RegisterEtablissement } from './pages/auth/RegisterEtablissement';
import RegisterOrganisation from './pages/auth/RegisterOrganisation';
import { RegisterStructure } from './pages/auth/RegisterStructure';
import { VerifyOTP } from './pages/auth/VerifyOTP';
import { Login } from './pages/auth/Login';
import { LoginOTP } from './pages/auth/LoginOTP';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { PendingValidation } from './pages/auth/PendingValidation';
import { ForcePasswordChange } from './pages/auth/ForcePasswordChange';
import { DashboardApprenant } from './pages/dashboard/DashboardApprenant';
import { DashboardMesCours } from './pages/dashboard/DashboardMesCours';
import { DashboardCertificats } from './pages/dashboard/DashboardCertificats';
import DashboardCareerStudio from './pages/dashboard/DashboardCareerStudio';
import CareerStudioEditor from './pages/dashboard/CareerStudioEditor';
import OmniaCareerStudio from './pages/OmniaCareerStudio';
import { DashboardParrainage } from './pages/dashboard/DashboardParrainage';
import { DashboardProfil } from './pages/dashboard/DashboardProfil';
import { DashboardProfesseur } from './pages/professeur/DashboardProfesseur';
import { ProfesseurMesFormations } from './pages/professeur/ProfesseurMesFormations';
import { ProfesseurStudioCreation } from './pages/professeur/ProfesseurStudioCreation';
import ProfesseurTarification from './pages/professeur/ProfesseurTarification';
import { ProfesseurPortefeuille } from './pages/professeur/ProfesseurPortefeuille';
import { ProfesseurAnalytique } from './pages/professeur/ProfesseurAnalytique';
import { ProfesseurProfil } from './pages/professeur/ProfesseurProfil';
import ProfesseurCertificats from './pages/professeur/ProfesseurCertificats';
import { DirecteurDashboard } from './pages/directeur/DirecteurDashboard';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import { DirecteurEnseignants } from './pages/directeur/DirecteurEnseignants';
import { DirecteurCatalogueInterne } from './pages/directeur/DirecteurCatalogueInterne';
import { DirecteurLicences } from './pages/directeur/DirecteurLicences';
import { DirecteurPortefeuille } from './pages/directeur/DirecteurPortefeuille';
import DirecteurCertificats from './pages/directeur/DirecteurCertificats';
import { EnseignantDashboard } from './pages/enseignant/EnseignantDashboard';
import { EnseignantMesCours } from './pages/enseignant/EnseignantMesCours';
import { EnseignantAnalytique } from './pages/enseignant/EnseignantAnalytique';
import ModerateurDashboard from './pages/moderateur/ModerateurDashboard';
import ModerateurCours from './pages/moderateur/ModerateurCours';
import ModerateurKyc from './pages/moderateur/ModerateurKyc';
import ModerateurUtilisateurs from './pages/moderateur/ModerateurUtilisateurs';
import ModerateurForum from './pages/moderateur/ModerateurForum';
import AdminForum from './pages/admin/AdminForum';
import AdminCareerStudio from './pages/admin/AdminCareerStudio';
import AdminJobOffers from './pages/admin/AdminJobOffers';
import AdminStudioValidation from './pages/admin/AdminStudioValidation';
import AdminCoursePricing from './pages/admin/AdminCoursePricing';
import AdminCourseHealth from './pages/admin/AdminCourseHealth';
import ModerateurOffresEmploi from './pages/moderateur/ModerateurOffresEmploi';
import ModerateurSupport from './pages/moderateur/ModerateurSupport';
import ModerateurAnalytique from './pages/moderateur/ModerateurAnalytique';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCMS from './pages/admin/AdminCMS';
import AdminFintech from './pages/admin/AdminFintech';
import AdminRetraits from './pages/admin/AdminRetraits';
import AdminMarketing from './pages/admin/AdminMarketing';
import AdminCatalogue from './pages/admin/AdminCatalogue';
import AdminEquipe from './pages/admin/AdminEquipe';
import AdminDemoAccess from './pages/admin/AdminDemoAccess';
import AdminCpdCredits from './pages/admin/AdminCpdCredits';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminCertificateSettings from './pages/admin/AdminCertificateSettings';
import AdminCertificatePreview from './pages/admin/AdminCertificatePreview';
import AdminMesFormations from './pages/admin/AdminMesFormations';
import AdminStructures from './pages/admin/AdminStructures';
import AdminStructureCodes from './pages/admin/AdminStructureCodes';
import AdminStructureAvantages from './pages/admin/AdminStructureAvantages';
import StudioConceptionFormation from './pages/studio/StudioConceptionFormation';
import ProfessorCourseStart from './pages/studio/ProfessorCourseStart';
import Checkout from './pages/Checkout';
import PaymentConfirmation from './pages/PaymentConfirmation';
import PaymentFailed from './pages/PaymentFailed';
import VerifyCertificate from './pages/VerifyCertificate';
import CpdPage from './pages/CpdPage';
import Forum from './pages/Forum';
import ForumGeneral from './pages/ForumGeneral';
import ForumPost from './pages/ForumPost';
import ForumCours from './pages/ForumCours';
import EspaceCarriere from './pages/EspaceCarriere';
import JobDetail from './pages/JobDetail';
import FormulaireRecruteur from './pages/FormulaireRecruteur';
import DemoDashboard from './pages/demo/DemoDashboard';
import { Sentry } from './lib/sentry';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PreviewReturnButton } from './components/PreviewReturnButton';
import StructureDashboard from './pages/structure/StructureDashboard';
import StructureMesFormations from './pages/structure/StructureMesFormations';
import StructureProfil from './pages/structure/StructureProfil';
import StructureCodes from './pages/structure/StructureCodes';
import StructureMembres from './pages/structure/StructureMembres';
import StructureAvantages from './pages/structure/StructureAvantages';
import StructureEquipe from './pages/structure/StructureEquipe';
import StructureJobs from './pages/structure/StructureJobs';
import StructureRecruitment from './pages/structure/StructureRecruitment';
import { DashboardStructure } from './pages/dashboard/DashboardStructure';
import RequireOmniaCareerLearner from './components/auth/RequireOmniaCareerLearner';
import RequireOmniaCareerAdmin from './components/auth/RequireOmniaCareerAdmin';
import OmniaCareerLayout from './layouts/OmniaCareerLayout';
import OmniaCareerEntry from './pages/omnia-career/OmniaCareerEntry';
import OmniaCareerCVBuilder from './pages/omnia-career/OmniaCareerCVBuilder';
import OmniaCareerLetters from './pages/omnia-career/OmniaCareerLetters';
import OmniaCareerInterview from './pages/omnia-career/OmniaCareerInterview';
import OmniaCareerApplications from './pages/omnia-career/OmniaCareerApplications';
import OmniaCareerProfile from './pages/omnia-career/OmniaCareerProfile';
import OmniaCareerCoaching from './pages/omnia-career/OmniaCareerCoaching';
import OmniaCareerSettings from './pages/omnia-career/OmniaCareerSettings';
import AdminOmniaCareerStudio from './pages/admin/AdminOmniaCareerStudio';
import TalentDirectory from './pages/TalentDirectory';
import TalentHome from './pages/talent/TalentHome';
import TalentExplore from './pages/talent/TalentExplore';
import TalentRecruiters from './pages/talent/TalentRecruiters';
import RecruiterDashboard from './pages/talent/RecruiterDashboard';
import TalentAbout from './pages/talent/TalentAbout';
import TalentOrganisations from './pages/talent/TalentOrganisations';
import TalentProfilePublic from './pages/talent/TalentProfilePublic';
import AdminTalent from './pages/admin/AdminTalent';
import AdminAssistedCourses from './pages/admin/AdminAssistedCourses';
import OmniaLiveHome from './pages/omnia-live/OmniaLiveHome';
import CatalogView from './pages/omnia-live/CatalogView';
import OmniaLiveAbout from './pages/omnia-live/OmniaLiveAbout';
import OmniaLiveMyLives from './pages/omnia-live/OmniaLiveMyLives';
import OmniaLiveOrganizers from './pages/omnia-live/OmniaLiveOrganizers';
import OmniaLivePropose from './pages/omnia-live/OmniaLivePropose';
import OmniaLiveDetail from './pages/omnia-live/OmniaLiveDetail';
import OmniaLiveStudio from './pages/omnia-live/OmniaLiveStudio';
import OmniaLiveStudioPresentation from './pages/omnia-live/OmniaLiveStudioPresentation';
import OmniaLiveStudioPlanning from './pages/omnia-live/OmniaLiveStudioPlanning';
import OmniaLiveStudioPricing from './pages/omnia-live/OmniaLiveStudioPricing';
import OmniaLiveStudioSpeakers from './pages/omnia-live/OmniaLiveStudioSpeakers';
import OmniaLiveStudioResources from './pages/omnia-live/OmniaLiveStudioResources';
import OmniaLiveStudioPreview from './pages/omnia-live/OmniaLiveStudioPreview';
import OmniaLiveUpload from './pages/omnia-live/OmniaLiveUpload';
import OmniaLiveMediaProcessing from './pages/omnia-live/OmniaLiveMediaProcessing';
import OmniaLiveRoom from './pages/omnia-live/OmniaLiveRoom';
import OmniaLiveHostRoom from './pages/omnia-live/OmniaLiveHostRoom';
import OmniaLiveAttendance from './pages/omnia-live/OmniaLiveAttendance';
import OmniaLiveCheckout from './pages/omnia-live/OmniaLiveCheckout';
import OmniaLiveOrders from './pages/omnia-live/OmniaLiveOrders';
import AdminOmniaLiveRefunds from './pages/omnia-live/AdminOmniaLiveRefunds';
import AdminOmniaLiveCancellations from './pages/omnia-live/AdminOmniaLiveCancellations';
import OmniaLiveOrganizerFinance from './pages/omnia-live/OmniaLiveOrganizerFinance';
import OmniaLiveReviews from './pages/omnia-live/OmniaLiveReviews';
import OmniaLivePrivateAccess from './pages/omnia-live/OmniaLivePrivateAccess';
import OmniaLiveOrganizerProfile from './pages/omnia-live/OmniaLiveOrganizerProfile';
import OmniaLiveAnalytics from './pages/omnia-live/OmniaLiveAnalytics';
import OmniaLiveDocuments from './pages/omnia-live/OmniaLiveDocuments';
import OmniaLiveDocumentVerify from './pages/omnia-live/OmniaLiveDocumentVerify';
import AdminOmniaLiveOverview from './pages/omnia-live/admin/AdminOmniaLiveOverview';
import AdminOmniaLiveValidation from './pages/omnia-live/admin/AdminOmniaLiveValidation';
import AdminOmniaLiveEvents from './pages/omnia-live/admin/AdminOmniaLiveEvents';
import AdminOmniaLiveEventDetail from './pages/omnia-live/admin/AdminOmniaLiveEventDetail';
import AdminOmniaLiveOrganizers from './pages/omnia-live/admin/AdminOmniaLiveOrganizers';
import AdminOmniaLiveStructures from './pages/omnia-live/admin/AdminOmniaLiveStructures';
import AdminOmniaLiveMedia from './pages/omnia-live/admin/AdminOmniaLiveMedia';
import AdminOmniaLiveFinance from './pages/omnia-live/admin/AdminOmniaLiveFinance';
import AdminOmniaLiveOperations from './pages/omnia-live/admin/AdminOmniaLiveOperations';
import AdminOmniaLiveSettings from './pages/omnia-live/admin/AdminOmniaLiveSettings';
import OrganizerDashboard from './pages/omnia-live/organizer/OrganizerDashboard';
import OrganizerEvents from './pages/omnia-live/organizer/OrganizerEvents';
import OrganizerEventDetail from './pages/omnia-live/organizer/OrganizerEventDetail';
import OrganizerParticipants from './pages/omnia-live/organizer/OrganizerParticipants';
import OrganizerMedia from './pages/omnia-live/organizer/OrganizerMedia';
import OrganizerAnalytics from './pages/omnia-live/organizer/OrganizerAnalytics';
import OrganizerSettings from './pages/omnia-live/organizer/OrganizerSettings';
import ParticipantDashboard from './pages/omnia-live/participant/ParticipantDashboard';
import ParticipantMyLives from './pages/omnia-live/participant/ParticipantMyLives';
import ParticipantLibrary from './pages/omnia-live/participant/ParticipantLibrary';
import ParticipantNotifications from './pages/omnia-live/participant/ParticipantNotifications';
import ParticipantRefunds from './pages/omnia-live/participant/ParticipantRefunds';
import OmniaLiveMediaHub from './pages/omnia-live/media/OmniaLiveMediaHub';
import OmniaLiveMediaVersions from './pages/omnia-live/media/OmniaLiveMediaVersions';
import LiveEngineRoom from './pages/omnia-live/live-engine/LiveEngineRoom';
import LiveEngineHost from './pages/omnia-live/live-engine/LiveEngineHost';
import OmniaLiveCommerceCheckout from './pages/omnia-live/commerce/OmniaLiveCommerceCheckout';
import OmniaLiveEntitlements from './pages/omnia-live/commerce/OmniaLiveEntitlements';
import OrganizerPayouts from './pages/omnia-live/commerce/OrganizerPayouts';
import AdminOmniaLiveCommerce from './pages/omnia-live/commerce/AdminOmniaLiveCommerce';
import MyLiveDocuments from './pages/omnia-live/documents/MyLiveDocuments';
import VerifyLiveDocument from './pages/omnia-live/documents/VerifyLiveDocument';
import AdminLiveDocuments from './pages/omnia-live/documents/AdminLiveDocuments';
import EventDocumentSettings from './pages/omnia-live/documents/EventDocumentSettings';
import OmniaLiveNotificationCenter from './pages/omnia-live/notifications/OmniaLiveNotificationCenter';
import OrganizerCommunications from './pages/omnia-live/organizer/OrganizerCommunications';
import OrganizerAccessCodes from './pages/omnia-live/organizer/OrganizerAccessCodes';
import AdminOmniaLiveCommunications from './pages/omnia-live/admin/AdminOmniaLiveCommunications';
import AdminOmniaLiveAutomationRules from './pages/omnia-live/admin/AdminOmniaLiveAutomationRules';
import OrganizerAnalyticsAdvanced from './pages/omnia-live/analytics/OrganizerAnalyticsAdvanced';
import AdminOmniaLiveAnalytics from './pages/omnia-live/admin/AdminOmniaLiveAnalytics';
import AdminOmniaLiveReports from './pages/omnia-live/admin/AdminOmniaLiveReports';
import StructureOmniaLiveReports from './pages/omnia-live/structure/StructureOmniaLiveReports';
import AdminOmniaLiveSecurity from './pages/omnia-live/admin/AdminOmniaLiveSecurity';
import AdminOmniaLiveIntegrity from './pages/omnia-live/admin/AdminOmniaLiveIntegrity';
import AdminOmniaLiveAudit from './pages/omnia-live/admin/AdminOmniaLiveAudit';
import OmniaLiveSystemStatus from './pages/omnia-live/system/OmniaLiveSystemStatus';
import OmniaLiveWatch from './pages/omnia-live/OmniaLiveWatch';
import AdminProfile from './pages/admin/AdminProfile';
import AdminOmniaLiveCreate from './pages/omnia-live/admin/AdminOmniaLiveCreate';

function MaintenanceNoticeBanner() {
  const { maintenanceNoticePlatform, maintenanceNoticeMessage, maintenanceNoticeAt } = useSiteMode();
  if (!maintenanceNoticePlatform || !maintenanceNoticeMessage) return null;

  const showAt = maintenanceNoticeAt ? new Date(maintenanceNoticeAt).getTime() : null;
  if (showAt && Date.now() < showAt) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] border-b px-4 py-2 text-center text-sm font-medium"
      style={{backgroundColor:'#FFF8E8',borderColor:'#BF8813',color:'#002050'}}>
      {maintenanceNoticeMessage}
    </div>
  );
}

function GuardedRoutes() {
  const {
    loading,
    maintenanceActive,
    maintenanceMessage,
    maintenanceEndTime,
    maintenanceModules,
    maintenanceModuleSchedules,
  } = useSiteMode();

  if (loading) return null;

  let isSuperAdmin = false;
  try {
    const stored = localStorage.getItem('omnia_user');
    isSuperAdmin = stored ? JSON.parse(stored)?.roles?.includes('super_admin') ?? false : false;
  } catch { /* ignore */ }

  if (isSuperAdmin) return <Outlet />;

  const path = window.location.pathname;
  const scheduleActive = (start: string | null, end: string | null) => {
    if (!start) return false;
    const now = Date.now();
    const startMs = new Date(start).getTime();
    const endMs = end ? new Date(end).getTime() : null;
    return now >= startMs && (!endMs || now < endMs);
  };

  const moduleActive = (key: keyof typeof maintenanceModules) =>
    maintenanceModules[key] ||
    scheduleActive(maintenanceModuleSchedules[key]?.start ?? null, maintenanceModuleSchedules[key]?.end ?? null);

  const targetedMaintenance =
    (moduleActive('omnia_live') && path.startsWith('/omnia-live')) ||
    (moduleActive('career') && (path.startsWith('/career-studio') || path.startsWith('/omnia-career'))) ||
    (moduleActive('talent') && (path.startsWith('/talent') || path.startsWith('/talents'))) ||
    (moduleActive('forum') && path.startsWith('/forum')) ||
    (moduleActive('payments') && (path.includes('/paiement') || path.includes('/checkout') || path.includes('/payout'))) ||
    (moduleActive('formations') && (
      path.startsWith('/catalogue') ||
      path.startsWith('/cours') ||
      path.includes('/formation') ||
      path.includes('/studio')
    ));

  if (maintenanceActive || targetedMaintenance) {
    return (
      <MaintenancePage
        maintenanceMessage={maintenanceMessage || 'Cette partie de la plateforme est temporairement indisponible pour maintenance.'}
        maintenanceEndTime={maintenanceEndTime ?? undefined}
      />
    );
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: '#F8F9FA' }}>
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#002050' }}>Une erreur est survenue</h1>
            <p className="mb-6 text-sm" style={{ color: '#6B7280' }}>
              Notre équipe a été automatiquement notifiée. Rechargez la page pour continuer.
            </p>
            <button
              onClick={resetError}
              className="px-6 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: '#002050' }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      )}
    >
      <BrowserRouter>
        <SiteModeProvider>
        <MaintenanceNoticeBanner />
        <PreviewReturnButton />
        <Routes>
        <Route path="/" element={<RootGate />} />
        <Route path="/accueil" element={<LandingPage />} />
          <Route path="/career-studio" element={<OmniaCareerStudio />} />
          <Route path="/talents" element={<TalentDirectory />} />
          <Route path="/talent" element={<TalentHome />} />
          <Route path="/talent/explorer" element={<TalentExplore />} />
          <Route path="/talent/recruteurs" element={<TalentRecruiters />} />
          <Route path="/talent/recruteur/dashboard" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/offres" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/talents" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/favoris" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/candidatures" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/entretiens" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/messages" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/profil" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/parametres" element={<RecruiterDashboard />} />
          <Route path="/talent/organisations" element={<TalentOrganisations />} />
          <Route path="/talent/a-propos" element={<TalentAbout />} />
          <Route path="/talent/profil/:profileId" element={<TalentProfilePublic />} />
          <Route path="/omnia-live" element={<OmniaLiveHome />} />
          <Route path="/omnia-live/en-direct" element={<CatalogView title="En direct maintenant" subtitle="Les sessions actuellement ouvertes apparaissent ici en temps réel." filter="live" />} />
          <Route path="/omnia-live/a-venir" element={<CatalogView title="Lives à venir" subtitle="Découvrez les prochains événements et consultez les horaires dans votre fuseau local." filter="upcoming" />} />
          <Route path="/omnia-live/explorer" element={<CatalogView title="Explorer Omnia Live" subtitle="Explorez les Lives, masterclass, ateliers, conférences et contenus disponibles." />} />
          <Route path="/omnia-live/formations" element={<CatalogView title="Formations Live" subtitle="Des formations synchrones structurées en plusieurs classes et sessions." filter="training" />} />
          <Route path="/omnia-live/videos" element={<CatalogView title="Vidéos & Replays" subtitle="Masterclass enregistrées, vidéos à la demande et replays validés par Omnia." filter="video" />} />
          <Route path="/omnia-live/organisateurs" element={<OmniaLiveOrganizers />} />
          <Route path="/omnia-live/mes-lives" element={<ParticipantMyLives />} />
          <Route path="/omnia-live/proposer" element={<OmniaLivePropose />} />
          <Route path="/omnia-live/studio/:liveId" element={<OmniaLiveStudio />} />
          <Route path="/omnia-live/studio/:liveId/presentation" element={<OmniaLiveStudioPresentation />} />
          <Route path="/omnia-live/studio/:liveId/planification" element={<OmniaLiveStudioPlanning />} />
          <Route path="/omnia-live/studio/:liveId/tarification" element={<OmniaLiveStudioPricing />} />
          <Route path="/omnia-live/studio/:liveId/intervenants" element={<OmniaLiveStudioSpeakers />} />
          <Route path="/omnia-live/studio/:liveId/ressources" element={<OmniaLiveStudioResources />} />
          <Route path="/omnia-live/studio/:liveId/upload" element={<OmniaLiveUpload />} />
          <Route path="/omnia-live/studio/:liveId/previsualisation" element={<OmniaLiveStudioPreview />} />
          <Route path="/omnia-live/a-propos" element={<OmniaLiveAbout />} />
          <Route path="/omnia-live/:liveId/salle" element={<LiveEngineRoom />} />
          <Route path="/omnia-live/:liveId/organiser" element={<LiveEngineHost />} />
          <Route path="/omnia-live/:liveId/presence" element={<OmniaLiveAttendance />} />
          <Route path="/omnia-live/:liveId/inscription" element={<OmniaLiveCheckout />} />
          <Route path="/omnia-live/mes-achats" element={<OmniaLiveOrders />} />
          <Route path="/admin/omnia-live/remboursements" element={<AdminOmniaLiveRefunds />} />
          <Route path="/omnia-live/:liveId/avis" element={<OmniaLiveReviews />} />
          <Route path="/omnia-live/revenus" element={<OmniaLiveOrganizerFinance />} />
          <Route path="/admin/omnia-live/annulations" element={<AdminOmniaLiveCancellations />} />
          <Route path="/omnia-live/acces-prive" element={<OmniaLivePrivateAccess />} />
          <Route path="/omnia-live/profil-organisateur" element={<OmniaLiveOrganizerProfile />} />
          <Route path="/omnia-live/:liveId/statistiques" element={<OmniaLiveAnalytics />} />
          <Route path="/omnia-live/mes-documents" element={<MyLiveDocuments />} />
          <Route path="/omnia-live/verifier-document" element={<OmniaLiveDocumentVerify />} />
          <Route path="/omnia-live/checkout" element={<OmniaLiveCommerceCheckout />} />
          <Route path="/omnia-live/mes-acces" element={<OmniaLiveEntitlements />} />
          <Route path="/omnia-live/organisateur/payouts" element={<OrganizerPayouts />} />
          <Route path="/admin/omnia-live/commerce" element={<AdminOmniaLiveCommerce />} />
          <Route path="/omnia-live/participant" element={<ParticipantDashboard />} />
          <Route path="/omnia-live/participant/mes-lives" element={<ParticipantMyLives />} />
          <Route path="/omnia-live/participant/bibliotheque" element={<ParticipantLibrary />} />
          <Route path="/omnia-live/participant/notifications" element={<ParticipantNotifications />} />
          <Route path="/omnia-live/participant/remboursements" element={<ParticipantRefunds />} />
          <Route path="/omnia-live/organisateur" element={<OrganizerDashboard />} />
          <Route path="/omnia-live/organisateur/evenements" element={<OrganizerEvents />} />
          <Route path="/omnia-live/organisateur/evenements/:eventId" element={<OrganizerEventDetail />} />
          <Route path="/omnia-live/organisateur/participants" element={<OrganizerParticipants />} />
          <Route path="/omnia-live/organisateur/medias" element={<OrganizerMedia />} />
          <Route path="/omnia-live/organisateur/statistiques" element={<OrganizerAnalytics />} />
          <Route path="/omnia-live/organisateur/parametres" element={<OrganizerSettings />} />
          <Route path="/omnia-live/media-center" element={<OmniaLiveMediaHub />} />
          <Route path="/omnia-live/media/:mediaId/versions" element={<OmniaLiveMediaVersions />} />
          <Route path="/omnia-live/watch/:mediaId" element={<OmniaLiveWatch />} />
          <Route path="/verify/live-document/:code" element={<VerifyLiveDocument />} />
          <Route path="/admin/omnia-live/documents" element={<AdminLiveDocuments />} />
          <Route path="/omnia-live/studio/:liveId/documents" element={<EventDocumentSettings />} />
          <Route path="/omnia-live/organisateur/communications" element={<OrganizerCommunications />} />
          <Route path="/omnia-live/organisateur/acces-prives" element={<OrganizerAccessCodes />} />
          <Route path="/admin/omnia-live/communications" element={<AdminOmniaLiveCommunications />} />
          <Route path="/admin/omnia-live/automatisations" element={<AdminOmniaLiveAutomationRules />} />
          <Route path="/omnia-live/organisateur/analytics-avances" element={<OrganizerAnalyticsAdvanced />} />
          <Route path="/admin/omnia-live/analytics" element={<AdminOmniaLiveAnalytics />} />
          <Route path="/admin/omnia-live/rapports" element={<AdminOmniaLiveReports />} />
          <Route path="/omnia-live/structure/rapports" element={<StructureOmniaLiveReports />} />
          <Route path="/admin/omnia-live/securite" element={<AdminOmniaLiveSecurity />} />
          <Route path="/admin/omnia-live/integrite" element={<AdminOmniaLiveIntegrity />} />
          <Route path="/admin/omnia-live/audit" element={<AdminOmniaLiveAudit />} />
          <Route path="/omnia-live/system-status" element={<OmniaLiveSystemStatus />} />
          <Route path="/omnia-live/:liveId" element={<OmniaLiveDetail />} />
        <Route path="/recruteur" element={<FormulaireRecruteur />} />
        <Route path="/verify/:certificateId" element={<VerifyCertificate />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/demo/dashboard" element={<DemoDashboard />} />
          <Route path="/admin/studio-validation" element={<AdminStudioValidation />} />
              <Route path="/admin/course-pricing" element={<AdminCoursePricing />} />
          <Route path="/admin/course-health" element={<AdminCourseHealth />} />

        {/* Auth — always accessible even in coming-soon mode */}
        <Route path="/connexion" element={<Login />} />
        <Route path="/connexion-rapide" element={<LoginOTP />} />
        <Route path="/inscription" element={<SelectRole />} />
        <Route path="/inscription/apprenant" element={<RegisterApprenant />} />
        <Route path="/inscription/professeur" element={<RegisterProfesseur />} />
          <Route path="/inscription/organisateur" element={<RegisterOrganizer />} />
          <Route path="/inscription/structure" element={<RegisterStructure />} />
          <Route path="/inscription/organisation" element={<RegisterOrganisation />} />
        <Route path="/verifier-otp" element={<VerifyOTP />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/en-attente-validation" element={<PendingValidation />} />
        <Route path="/changer-mot-de-passe" element={<ForcePasswordChange />} />

        {/* Admin — always accessible */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/profil" element={<AdminProfile />} />
        <Route path="/admin/talent" element={<AdminTalent />} />
        <Route path="/admin/omnia-live" element={<AdminOmniaLiveOverview />} />
        <Route path="/admin/omnia-live/creer" element={<AdminOmniaLiveCreate />} />
        <Route path="/admin/omnia-live/validation" element={<AdminOmniaLiveValidation />} />
        <Route path="/admin/omnia-live/evenements" element={<AdminOmniaLiveEvents />} />
        <Route path="/admin/omnia-live/evenements/:eventId" element={<AdminOmniaLiveEventDetail />} />
        <Route path="/admin/omnia-live/organisateurs" element={<AdminOmniaLiveOrganizers />} />
        <Route path="/admin/omnia-live/structures" element={<AdminOmniaLiveStructures />} />
        <Route path="/admin/omnia-live/medias" element={<AdminOmniaLiveMedia />} />
        <Route path="/admin/omnia-live/finance" element={<AdminOmniaLiveFinance />} />
        <Route path="/admin/omnia-live/operations" element={<AdminOmniaLiveOperations />} />
        <Route path="/admin/omnia-live/parametres" element={<AdminOmniaLiveSettings />} />
<Route path="/admin/assisted-courses" element={<AdminAssistedCourses />} />
        <Route path="/admin/cms-branding" element={<AdminCMS />} />
        <Route path="/admin/fintech" element={<AdminFintech />} />
        <Route path="/admin/payouts" element={<AdminRetraits />} />
        <Route path="/admin/marketing" element={<AdminMarketing />} />
        <Route path="/admin/courses" element={<AdminCatalogue />} />
        <Route path="/admin/courses/new" element={<Navigate to="/admin/studio/new" replace />} />
        <Route path="/admin/courses/:id/edit" element={<StudioConceptionFormation />} />
        <Route path="/admin/team" element={<AdminEquipe />} />
        <Route path="/admin/demo-access" element={<AdminDemoAccess />} />
        <Route path="/admin/cpd-credits" element={<AdminCpdCredits />} />
          <Route path="/admin/certificates" element={<AdminCertificates />} />
<Route path="/admin/certificate-settings" element={<AdminCertificateSettings />} />
          <Route path="/admin/certificate-preview" element={<AdminCertificatePreview />} />
          <Route path="/admin/studio-mes-formations" element={<AdminMesFormations />} />
          <Route path="/admin/structures" element={<AdminStructures />} />
<Route path="/admin/structure-codes" element={<AdminStructureCodes />} />
<Route path="/admin/structure-avantages" element={<AdminStructureAvantages />} />
          
        {/* Moderator — always accessible (English + French paths) */}
        <Route path="/moderator/dashboard" element={<ModerateurDashboard />} />
        <Route path="/moderateur/dashboard" element={<ModerateurDashboard />} />
        <Route path="/moderator/courses" element={<ModerateurCours />} />
        <Route path="/moderateur/cours" element={<ModerateurCours />} />
        <Route path="/moderator/kyc" element={<ModerateurKyc />} />
        <Route path="/moderateur/kyc" element={<ModerateurKyc />} />
        <Route path="/moderator/users" element={<ModerateurUtilisateurs />} />
        <Route path="/moderateur/utilisateurs" element={<ModerateurUtilisateurs />} />
        <Route path="/moderator/forum" element={<ModerateurForum />} />
          <Route path="/admin/forum" element={<AdminForum />} />
          <Route path="/admin/career-studio" element={<AdminCareerStudio />} />
          <Route path="/admin/offres-emploi" element={<AdminJobOffers />} />
        <Route path="/moderateur/forum" element={<ModerateurForum />} />
        <Route path="/moderator/jobs" element={<ModerateurOffresEmploi />} />
        <Route path="/moderateur/emploi" element={<ModerateurOffresEmploi />} />
        <Route path="/moderator/support" element={<ModerateurSupport />} />
        <Route path="/moderateur/support" element={<ModerateurSupport />} />
        <Route path="/moderator/analytics" element={<ModerateurAnalytique />} />
        <Route path="/moderateur/analytique" element={<ModerateurAnalytique />} />

        {/* Module 6 — Dashboard apprenant — always accessible */}
        <Route path="/dashboard" element={<DashboardApprenant />} />
        <Route path="/dashboard/mes-cours" element={<DashboardMesCours />} />
        <Route path="/dashboard/certificats" element={<DashboardCertificats />} />
          <Route path="/dashboard/career-studio" element={<DashboardCareerStudio />} />
          <Route path="/dashboard/career-studio/editor/:docId" element={<CareerStudioEditor />} />
        <Route path="/dashboard/career-studio/editor/new" element={<CareerStudioEditor />} />
        <Route path="/dashboard/parrainage" element={<DashboardParrainage />} />
        <Route path="/dashboard/profil" element={<DashboardProfil />} />
          <Route path="/dashboard/structure" element={<DashboardStructure />} />

        {/* Module 7 — Dashboard professeur — always accessible */}
        <Route path="/professeur/dashboard" element={<DashboardProfesseur />} />
        <Route path="/professeur/courses" element={<ProfesseurMesFormations />} />
        <Route path="/professeur/courses/new" element={<ProfessorCourseStart />} />
        <Route path="/professeur/courses/:id/edit" element={<StudioConceptionFormation />} />
          <Route path="/professeur/studio/new" element={<StudioConceptionFormation />} />
<Route path="/professeur/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/partner/studio/new" element={<StudioConceptionFormation />} />
<Route path="/partner/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/admin/studio/new" element={<StudioConceptionFormation />} />
<Route path="/admin/studio/:courseId" element={<StudioConceptionFormation />} />
        <Route path="/admin/studio/:courseId/evaluations" element={<StudioEvaluations />} />
        <Route path="/professeur/studio/:courseId/evaluations" element={<StudioEvaluations />} />
        <Route path="/structure/studio/:courseId/evaluations" element={<StudioEvaluations />} />
<Route path="/structure/studio/new" element={<StudioConceptionFormation />} />
<Route path="/structure/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/structure/formations/nouvelle" element={<Navigate to="/structure/studio/new" replace />} />

        <Route path="/professeur/payouts" element={<ProfesseurPortefeuille />} />
        <Route path="/professeur/analytics" element={<ProfesseurAnalytique />} />
        <Route path="/professeur/profile" element={<ProfesseurProfil />} />
          <Route path="/professeur/certificats" element={<ProfesseurCertificats />} />

        {/* Module 8 — Dashboard directeur — always accessible */}
          <Route path="/structure/dashboard" element={<StructureDashboard />} />
          <Route path="/structure/formations" element={<StructureMesFormations />} />
          <Route path="/structure/profil" element={<StructureProfil />} />
<Route path="/structure/codes" element={<StructureCodes />} />
<Route path="/structure/membres" element={<StructureMembres />} />
<Route path="/structure/rattachements" element={<StructureMembres />} />
<Route path="/structure/avantages" element={<StructureAvantages />} />
<Route path="/structure/equipe" element={<StructureEquipe />} />
<Route path="/structure/offres-emploi" element={<StructureJobs />} />
<Route path="/structure/recrutement/dashboard" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/offres" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/talents" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/favoris" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/candidats" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/entretiens" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/messages" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/statistiques" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/equipe" element={<StructureRecruitment />} />


        {/* Module 8 — Dashboard enseignant — always accessible */}
        <Route path="/staff/dashboard" element={<EnseignantDashboard />} />
        <Route path="/staff/courses" element={<EnseignantMesCours />} />
        <Route path="/staff/courses/new" element={<ProfesseurStudioCreation />} />
        <Route path="/staff/courses/:id/edit" element={<ProfesseurStudioCreation />} />
        <Route path="/staff/analytics" element={<EnseignantAnalytique />} />

        {/* Module 11 — Paiement — always accessible */}
        <Route path="/paiement/:courseId" element={<Checkout />} />
        <Route path="/paiement/confirmation" element={<PaymentConfirmation />} />
        <Route path="/paiement/echec" element={<PaymentFailed />} />

        {/* Module 12 — CPD — always accessible */}
        <Route path="/cpd" element={<CpdPage />} />

        {/* Module 14 — Forum & Carrière — always accessible */}
        <Route path="/forum" element={<Forum />} />
        <Route path="/forum/general" element={<ForumGeneral />} />
        <Route path="/forum/carriere" element={<ForumGeneral />} />
        <Route path="/forum/post/:postId" element={<ForumPost />} />
        <Route path="/forum/cours/:courseId" element={<ForumCours />} />
        <Route path="/emploi" element={<EspaceCarriere />} />
        <Route path="/emploi/:jobId" element={<JobDetail />} />

<Route element={<RequireOmniaCareerLearner />}>
  <Route path="/omnia-career" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/cv-builder" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/lettres" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/entretien" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/candidatures" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/profil" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/coaching" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/parametres" element={<DashboardCareerStudio />} />
</Route>

<Route element={<RequireOmniaCareerAdmin />}>
  <Route path="/admin/omnia-career" element={<Navigate to="/admin/career-studio" replace />} />
</Route>

        {/* Public routes guarded by coming-soon mode */}
        <Route element={<GuardedRoutes />}>
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
              <Route path="/cgu" element={<LegalDocumentPage />} />
              <Route path="/mentions-legales" element={<LegalDocumentPage />} />
              <Route path="/cookies" element={<LegalDocumentPage />} />
              <Route path="/cgv" element={<LegalDocumentPage />} />
              <Route path="/remboursements" element={<LegalDocumentPage />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/cours/:id/apercu" element={<ApercuGratuit />} />
        <Route path="/cours/:id" element={<CoursDetail />} />
        <Route path="/cours/:id/apprendre/:lessonId" element={<CoursLecteur />} />
        <Route path="/cours/:id/apprendre" element={<CoursLecteur />} />
        <Route path="/cours/:id/examen-module/:moduleId" element={<ExamenModule />} />
        <Route path="/cours/:id/validation-finale" element={<ValidationFinale />} />
        </Route>{/* end GuardedRoutes */}
        </Routes>
        </SiteModeProvider>
        <PwaInstallBanner />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  );
}