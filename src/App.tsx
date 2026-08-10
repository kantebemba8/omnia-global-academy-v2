import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { RootGate } from './components/RootGate';

import { SiteModeProvider, useSiteMode } from './context/SiteModeContext';

import { captureError } from './lib/sentry';
import { isRecoverableChunkError, recoverFromChunkError } from './lib/pwaRecovery';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { PreviewReturnButton } from './components/PreviewReturnButton';
import { PlatformRoleGate } from './components/auth/PlatformRoleGate';
import { MobileNotificationBridge } from './components/mobile/MobileNotificationBridge';
import { MobileStoreRecoveryBridge } from './components/mobile/MobileStoreRecoveryBridge';


function LegacyJobRedirect() {
  const { jobId } = useParams();
  return <Navigate to={`/forum/emploi/${jobId || ''}`} replace />;
}

const RequireOmniaCareerLearner = lazy(() => import('./components/auth/RequireOmniaCareerLearner'));
const RequireOmniaCareerAdmin = lazy(() => import('./components/auth/RequireOmniaCareerAdmin'));

const StudioEvaluations = lazy(() => import('./pages/studio/StudioEvaluations').then((module) => ({ default: module.StudioEvaluations })));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage').then((module) => ({ default: module.MaintenancePage })));
const NotFound = lazy(() => import('./pages/NotFound'));
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const ConnectedHome = lazy(() => import('./pages/ConnectedHome'));
const APropos = lazy(() => import('./pages/APropos').then((module) => ({ default: module.APropos })));
const AudienceRolePage = lazy(() => import('./pages/AudienceRolePage').then((module) => ({ default: module.AudienceRolePage })));
const Contact = lazy(() => import('./pages/Contact'));
const NewsletterPreferencesPage = lazy(() => import('./pages/NewsletterPreferencesPage'));
const Confidentialite = lazy(() => import('./pages/Confidentialite').then((module) => ({ default: module.Confidentialite })));
const SupprimerCompte = lazy(() => import('./pages/SupprimerCompte').then((module) => ({ default: module.SupprimerCompte })));
const CompteSupprime = lazy(() => import('./pages/CompteSupprime').then((module) => ({ default: module.CompteSupprime })));
const LegalDocumentPage = lazy(() => import('./pages/LegalDocumentPage'));
const Catalogue = lazy(() => import('./pages/Catalogue').then((module) => ({ default: module.Catalogue })));
const ExternalCourseAccess = lazy(() => import('./pages/ExternalCourseAccess'));
const CoursDetail = lazy(() => import('./pages/CoursDetail').then((module) => ({ default: module.CoursDetail })));
const ApercuGratuit = lazy(() => import('./pages/ApercuGratuit').then((module) => ({ default: module.ApercuGratuit })));
const CoursLecteur = lazy(() => import('./pages/CoursLecteur').then((module) => ({ default: module.CoursLecteur })));
const ExamenModule = lazy(() => import('./pages/ExamenModule').then((module) => ({ default: module.ExamenModule })));
const ValidationFinale = lazy(() => import('./pages/ValidationFinale').then((module) => ({ default: module.ValidationFinale })));
const SelectRole = lazy(() => import('./pages/auth/SelectRole').then((module) => ({ default: module.SelectRole })));
const RegisterApprenant = lazy(() => import('./pages/auth/RegisterApprenant').then((module) => ({ default: module.RegisterApprenant })));
const AccessInvitationPage = lazy(() => import('./pages/auth/AccessInvitationPage'));
const RegisterProfesseur = lazy(() => import('./pages/auth/RegisterProfesseur').then((module) => ({ default: module.RegisterProfesseur })));
const RegisterOrganizer = lazy(() => import('./pages/auth/RegisterOrganizer').then((module) => ({ default: module.RegisterOrganizer })));
const RegisterRecruiterIndependent = lazy(() => import('./pages/auth/RegisterRecruiterIndependent').then((module) => ({ default: module.RegisterRecruiterIndependent })));
const RegisterStructure = lazy(() => import('./pages/auth/RegisterStructure').then((module) => ({ default: module.RegisterStructure })));
const VerifyOTP = lazy(() => import('./pages/auth/VerifyOTP').then((module) => ({ default: module.VerifyOTP })));
const Login = lazy(() => import('./pages/auth/Login').then((module) => ({ default: module.Login })));
const LoginOTP = lazy(() => import('./pages/auth/LoginOTP').then((module) => ({ default: module.LoginOTP })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword').then((module) => ({ default: module.ResetPassword })));
const PendingValidation = lazy(() => import('./pages/auth/PendingValidation').then((module) => ({ default: module.PendingValidation })));
const ForcePasswordChange = lazy(() => import('./pages/auth/ForcePasswordChange').then((module) => ({ default: module.ForcePasswordChange })));
const DashboardApprenant = lazy(() => import('./pages/dashboard/DashboardApprenant').then((module) => ({ default: module.DashboardApprenant })));
const DashboardMesCours = lazy(() => import('./pages/dashboard/DashboardMesCours').then((module) => ({ default: module.DashboardMesCours })));
const DashboardAssessments = lazy(() => import('./pages/dashboard/DashboardAssessments'));
const AssessmentSession = lazy(() => import('./pages/AssessmentSession'));
const AssessmentJuryAccess = lazy(() => import('./pages/AssessmentJuryAccess'));
const DashboardCertificats = lazy(() => import('./pages/dashboard/DashboardCertificats').then((module) => ({ default: module.DashboardCertificats })));
const DashboardBadges = lazy(() => import('./pages/dashboard/DashboardBadges'));
const DashboardLearningRecord = lazy(() => import('./pages/dashboard/DashboardLearningRecord'));
const DashboardSkillsPassport = lazy(() => import('./pages/dashboard/DashboardSkillsPassport'));
const DashboardProjectPortfolio = lazy(() => import('./pages/dashboard/DashboardProjectPortfolio'));
const DashboardCareerStudio = lazy(() => import('./pages/dashboard/DashboardCareerStudio'));
const CareerStudioEditor = lazy(() => import('./pages/dashboard/CareerStudioEditor'));
const OmniaCareerStudio = lazy(() => import('./pages/OmniaCareerStudio'));
const DashboardParrainage = lazy(() => import('./pages/dashboard/DashboardParrainage').then((module) => ({ default: module.DashboardParrainage })));
const UnifiedProfilePage = lazy(() => import('./pages/profile/UnifiedProfilePage'));
const PublicProfilePage = lazy(() => import('./pages/profile/PublicProfilePage'));
const DashboardProfesseur = lazy(() => import('./pages/professeur/DashboardProfesseur').then((module) => ({ default: module.DashboardProfesseur })));
const ProfesseurMesFormations = lazy(() => import('./pages/professeur/ProfesseurMesFormations').then((module) => ({ default: module.ProfesseurMesFormations })));
const ProfesseurAssessmentCenter = lazy(() => import('./pages/professeur/ProfesseurAssessmentCenter'));
const ProfesseurJuries = lazy(() => import('./pages/professeur/ProfesseurJuries'));
const ProfesseurPortefeuille = lazy(() => import('./pages/professeur/ProfesseurPortefeuille').then((module) => ({ default: module.ProfesseurPortefeuille })));
const ProfesseurAnalytique = lazy(() => import('./pages/professeur/ProfesseurAnalytique').then((module) => ({ default: module.ProfesseurAnalytique })));
const ProfesseurProfil = lazy(() => import('./pages/professeur/ProfesseurProfil').then((module) => ({ default: module.ProfesseurProfil })));
const ProfesseurCertificats = lazy(() => import('./pages/professeur/ProfesseurCertificats'));
const ModerateurDashboard = lazy(() => import('./pages/moderateur/ModerateurDashboard'));
const ModerateurCours = lazy(() => import('./pages/moderateur/ModerateurCours'));
const ModerateurKyc = lazy(() => import('./pages/moderateur/ModerateurKyc'));
const ModerateurUtilisateurs = lazy(() => import('./pages/moderateur/ModerateurUtilisateurs'));
const ModerateurForum = lazy(() => import('./pages/moderateur/ModerateurForum'));
const AdminForum = lazy(() => import('./pages/admin/AdminForum'));
const AdminCareerStudio = lazy(() => import('./pages/admin/AdminCareerStudio'));
const AdminCareerStudioDetail = lazy(() => import('./pages/admin/AdminCareerStudioDetail'));
const AdminJobOffers = lazy(() => import('./pages/admin/AdminJobOffers'));
const AdminCoursePricing = lazy(() => import('./pages/admin/AdminCoursePricing'));
const AdminQualityCenter = lazy(() => import('./pages/admin/AdminQualityCenter'));
const AdminRecognitionHub = lazy(() => import('./pages/admin/AdminRecognitionHub'));
const AdminProfessionalPathways = lazy(() => import('./pages/admin/AdminProfessionalPathways'));
const DashboardProfessionalPathways = lazy(() => import('./pages/dashboard/DashboardProfessionalPathways'));
const DashboardEmployability = lazy(() => import('./pages/dashboard/DashboardEmployability'));
const VerifiedTalentCandidates = lazy(() => import('./pages/talent/VerifiedTalentCandidates'));
const VerifiedTalentCandidateDetail = lazy(() => import('./pages/talent/VerifiedTalentCandidateDetail'));
const AdminEmployabilityIntegration = lazy(() => import('./pages/admin/AdminEmployabilityIntegration'));
const AdminAssessmentCenter = lazy(() => import('./pages/admin/AdminAssessmentCenter'));
const AdminAssessmentGovernance = lazy(() => import('./pages/admin/AdminAssessmentGovernance'));
const ModerateurOffresEmploi = lazy(() => import('./pages/moderateur/ModerateurOffresEmploi'));
const ModerateurSupport = lazy(() => import('./pages/moderateur/ModerateurSupport'));
const ModerateurAnalytique = lazy(() => import('./pages/moderateur/ModerateurAnalytique'));
const ModerateurMissions = lazy(() => import('./pages/moderateur/ModerateurMissions'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminDeletionRequests = lazy(() => import('./pages/admin/AdminDeletionRequests'));
const AdminRoleUsers = lazy(() => import('./pages/admin/AdminRoleUsers'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminActivityToday = lazy(() => import('./pages/admin/AdminActivityToday'));
const AdminCMS = lazy(() => import('./pages/admin/AdminCMS'));
const AdminTranslations = lazy(() => import('./pages/admin/AdminTranslations'));
const LandingDraftPreview = lazy(() => import('./pages/admin/LandingDraftPreview'));
const AdminFintech = lazy(() => import('./pages/admin/AdminFintech'));
const AdminMonetization = lazy(() => import('./pages/admin/AdminMonetization'));
const CommerceCatalog = lazy(() => import('./pages/commerce/CommerceCatalog'));
const CreatorCommerce = lazy(() => import('./pages/commerce/CreatorCommerce'));
const AdminRetraits = lazy(() => import('./pages/admin/AdminRetraits'));
const AdminMarketing = lazy(() => import('./pages/admin/AdminMarketing'));
const AdminCatalogue = lazy(() => import('./pages/admin/AdminCatalogue'));
const AdminEquipe = lazy(() => import('./pages/admin/AdminEquipe'));
const AdminDemoAccess = lazy(() => import('./pages/admin/AdminDemoAccess'));
const AdminCpdCredits = lazy(() => import('./pages/admin/AdminCpdCredits'));
const AdminCertificates = lazy(() => import('./pages/admin/AdminCertificates'));
const AdminCertificateSettings = lazy(() => import('./pages/admin/AdminCertificateSettings'));
const AdminCertificateTemplates = lazy(() => import('./pages/admin/AdminCertificateTemplates'));
const AdminCertificatePreview = lazy(() => import('./pages/admin/AdminCertificatePreview'));
const AdminMesFormations = lazy(() => import('./pages/admin/AdminMesFormations'));
const AdminStructures = lazy(() => import('./pages/admin/AdminStructures'));
const AdminStructureCodes = lazy(() => import('./pages/admin/AdminStructureCodes'));
const AdminStructureB2B = lazy(() => import('./pages/admin/AdminStructureB2B'));
const AdminCredentials = lazy(() => import('./pages/admin/AdminCredentials'));
const StudioConceptionFormation = lazy(() => import('./pages/studio/StudioConceptionFormation'));
const ProfessorCourseStart = lazy(() => import('./pages/studio/ProfessorCourseStart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const PaymentConfirmation = lazy(() => import('./pages/PaymentConfirmation'));
const PaymentFailed = lazy(() => import('./pages/PaymentFailed'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'));
const CpdPage = lazy(() => import('./pages/CpdPage'));
const PublicBadgeVerification = lazy(() => import('./pages/credentials/PublicBadgeVerification'));
const PublicClrShare = lazy(() => import('./pages/credentials/PublicClrShare'));
const PublicSkillsPassport = lazy(() => import('./pages/credentials/PublicSkillsPassport'));
const ProfessionalPathwayCredentialVerify = lazy(() => import('./pages/credentials/ProfessionalPathwayCredentialVerify'));
const Forum = lazy(() => import('./pages/Forum'));
const ForumGeneral = lazy(() => import('./pages/ForumGeneral'));
const ForumPost = lazy(() => import('./pages/ForumPost'));
const ForumCours = lazy(() => import('./pages/ForumCours'));
const CommunityCourseForums = lazy(() => import('./pages/CommunityCourseForums'));
const EspaceCarriere = lazy(() => import('./pages/EspaceCarriere'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const FormulaireRecruteur = lazy(() => import('./pages/FormulaireRecruteur'));
const DemoDashboard = lazy(() => import('./pages/demo/DemoDashboard'));
const StructureDashboard = lazy(() => import('./pages/structure/StructureDashboard'));
const StructureMesFormations = lazy(() => import('./pages/structure/StructureMesFormations'));
const StructureProfil = lazy(() => import('./pages/structure/StructureProfil'));
const StructureCodes = lazy(() => import('./pages/structure/StructureCodes'));
const StructureMembres = lazy(() => import('./pages/structure/StructureMembres'));
const StructureEquipe = lazy(() => import('./pages/structure/StructureEquipe'));
const StructureJobs = lazy(() => import('./pages/structure/StructureJobs'));
const StructureRecruitment = lazy(() => import('./pages/structure/StructureRecruitment'));
const StructureB2B = lazy(() => import('./pages/structure/StructureB2B'));
const StructureOrganisation = lazy(() => import('./pages/structure/StructureOrganisation'));
const StructureRHConformite = lazy(() => import('./pages/structure/StructureRHConformite'));
const DashboardStructure = lazy(() => import('./pages/dashboard/DashboardStructure').then((module) => ({ default: module.DashboardStructure })));
const PartnerRecognitionWorkspace = lazy(() => import('./pages/partner/PartnerRecognitionWorkspace'));
const TalentDirectory = lazy(() => import('./pages/TalentDirectory'));
const TalentHome = lazy(() => import('./pages/talent/TalentHome'));
const TalentExplore = lazy(() => import('./pages/talent/TalentExplore'));
const TalentRecruiters = lazy(() => import('./pages/talent/TalentRecruiters'));
const RecruiterDashboard = lazy(() => import('./pages/talent/RecruiterDashboard'));
const TalentAbout = lazy(() => import('./pages/talent/TalentAbout'));
const TalentOrganisations = lazy(() => import('./pages/talent/TalentOrganisations'));
const TalentProfilePublic = lazy(() => import('./pages/talent/TalentProfilePublic'));
const AdminTalent = lazy(() => import('./pages/admin/AdminTalent'));
const AdminCoaching = lazy(() => import('./pages/admin/AdminCoaching'));
const AdminCoachingOffers = lazy(() => import('./pages/admin/AdminCoachingOffers'));
const AdminCoachingFinance = lazy(() => import('./pages/admin/AdminCoachingFinance'));
const AdminCoachingSessions = lazy(() => import('./pages/admin/AdminCoachingSessions'));
const AdminCoachingDisputes = lazy(() => import('./pages/admin/AdminCoachingDisputes'));
const AdminCoachingRatings = lazy(() => import('./pages/admin/AdminCoachingRatings'));
const AdminCoachingRevenue = lazy(() => import('./pages/admin/AdminCoachingRevenue'));
const CoachingCatalogue = lazy(() => import('./pages/coaching/CoachingCatalogue'));
const CoachingCoachProfile = lazy(() => import('./pages/coaching/CoachingCoachProfile'));
const CoachingBooking = lazy(() => import('./pages/coaching/CoachingBooking'));
const CoachingPayment = lazy(() => import('./pages/coaching/CoachingPayment'));
const CoachApplication = lazy(() => import('./pages/coaching/CoachApplication'));
const CoachDashboard = lazy(() => import('./pages/coaching/CoachDashboard'));
const CoachOffers = lazy(() => import('./pages/coaching/CoachOffers'));
const CoachCalendar = lazy(() => import('./pages/coaching/CoachCalendar'));
const CoachSessions = lazy(() => import('./pages/coaching/CoachSessions'));
const LearnerCoachingDashboard = lazy(() => import('./pages/coaching/LearnerCoachingDashboard'));
const CoachingSessionRoom = lazy(() => import('./pages/coaching/CoachingSessionRoom'));
const CoachingSessionFollowUp = lazy(() => import('./pages/coaching/CoachingSessionFollowUp'));
const CoachReviews = lazy(() => import('./pages/coaching/CoachReviews'));
const CoachRevenue = lazy(() => import('./pages/coaching/CoachRevenue'));
const CoachingAdvancedHub = lazy(() => import('./pages/coaching/CoachingAdvancedHub'));
const CoachingAdvancedPayment = lazy(() => import('./pages/coaching/CoachingAdvancedPayment'));
const CoachingGroupRoom = lazy(() => import('./pages/coaching/CoachingGroupRoom'));
const CoachAdvancedProducts = lazy(() => import('./pages/coaching/CoachAdvancedProducts'));
const AdminCoachingAdvanced = lazy(() => import('./pages/admin/AdminCoachingAdvanced'));
const AdminAssistedCourses = lazy(() => import('./pages/admin/AdminAssistedCourses'));
const OmniaLiveHome = lazy(() => import('./pages/omnia-live/OmniaLiveHome'));
const CatalogView = lazy(() => import('./pages/omnia-live/CatalogView'));
const OmniaLiveAbout = lazy(() => import('./pages/omnia-live/OmniaLiveAbout'));
const OmniaLiveOrganizers = lazy(() => import('./pages/omnia-live/OmniaLiveOrganizers'));
const OmniaLivePropose = lazy(() => import('./pages/omnia-live/OmniaLivePropose'));
const OmniaLiveDetail = lazy(() => import('./pages/omnia-live/OmniaLiveDetail'));
const OmniaLiveStudio = lazy(() => import('./pages/omnia-live/OmniaLiveStudio'));
const OmniaLiveStudioPresentation = lazy(() => import('./pages/omnia-live/OmniaLiveStudioPresentation'));
const OmniaLiveStudioPlanning = lazy(() => import('./pages/omnia-live/OmniaLiveStudioPlanning'));
const OmniaLiveStudioPricing = lazy(() => import('./pages/omnia-live/OmniaLiveStudioPricing'));
const OmniaLiveStudioSpeakers = lazy(() => import('./pages/omnia-live/OmniaLiveStudioSpeakers'));
const OmniaLiveStudioResources = lazy(() => import('./pages/omnia-live/OmniaLiveStudioResources'));
const OmniaLiveStudioPreview = lazy(() => import('./pages/omnia-live/OmniaLiveStudioPreview'));
const OmniaLiveUpload = lazy(() => import('./pages/omnia-live/OmniaLiveUpload'));
const OmniaLiveAttendance = lazy(() => import('./pages/omnia-live/OmniaLiveAttendance'));
const OmniaLiveCheckout = lazy(() => import('./pages/omnia-live/OmniaLiveCheckout'));
const OmniaLiveOrders = lazy(() => import('./pages/omnia-live/OmniaLiveOrders'));
const OmniaLiveOrganizerFinance = lazy(() => import('./pages/omnia-live/OmniaLiveOrganizerFinance'));
const OmniaLiveReviews = lazy(() => import('./pages/omnia-live/OmniaLiveReviews'));
const OmniaLivePrivateAccess = lazy(() => import('./pages/omnia-live/OmniaLivePrivateAccess'));
const OmniaLiveOrganizerProfile = lazy(() => import('./pages/omnia-live/OmniaLiveOrganizerProfile'));
const OmniaLiveAnalytics = lazy(() => import('./pages/omnia-live/OmniaLiveAnalytics'));
const OmniaLiveDocumentVerify = lazy(() => import('./pages/omnia-live/OmniaLiveDocumentVerify'));
const AdminOmniaLiveOverview = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveOverview'));
const AdminOmniaLiveValidation = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveValidation'));
const AdminOmniaLiveEvents = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveEvents'));
const AdminOmniaLiveEventDetail = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveEventDetail'));
const AdminOmniaLiveOrganizers = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveOrganizers'));
const AdminOmniaLiveStructures = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveStructures'));
const AdminOmniaLiveMedia = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveMedia'));
const AdminOmniaLiveFinance = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveFinance'));
const AdminOmniaLiveOperations = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveOperations'));
const AdminOmniaLiveSettings = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveSettings'));
const OrganizerDashboard = lazy(() => import('./pages/omnia-live/organizer/OrganizerDashboard'));
const OrganizerEvents = lazy(() => import('./pages/omnia-live/organizer/OrganizerEvents'));
const OrganizerEventDetail = lazy(() => import('./pages/omnia-live/organizer/OrganizerEventDetail'));
const OrganizerParticipants = lazy(() => import('./pages/omnia-live/organizer/OrganizerParticipants'));
const OrganizerMedia = lazy(() => import('./pages/omnia-live/organizer/OrganizerMedia'));
const OrganizerAnalytics = lazy(() => import('./pages/omnia-live/organizer/OrganizerAnalytics'));
const OrganizerSettings = lazy(() => import('./pages/omnia-live/organizer/OrganizerSettings'));
const ParticipantDashboard = lazy(() => import('./pages/omnia-live/participant/ParticipantDashboard'));
const ParticipantMyLives = lazy(() => import('./pages/omnia-live/participant/ParticipantMyLives'));
const ParticipantLibrary = lazy(() => import('./pages/omnia-live/participant/ParticipantLibrary'));
const ParticipantNotifications = lazy(() => import('./pages/omnia-live/participant/ParticipantNotifications'));
const ParticipantRefunds = lazy(() => import('./pages/omnia-live/participant/ParticipantRefunds'));
const OmniaLiveMediaHub = lazy(() => import('./pages/omnia-live/media/OmniaLiveMediaHub'));
const OmniaLiveMediaVersions = lazy(() => import('./pages/omnia-live/media/OmniaLiveMediaVersions'));
const LiveEngineRoom = lazy(() => import('./pages/omnia-live/live-engine/LiveEngineRoom'));
const LiveEngineHost = lazy(() => import('./pages/omnia-live/live-engine/LiveEngineHost'));
const OmniaLiveCommerceCheckout = lazy(() => import('./pages/omnia-live/commerce/OmniaLiveCommerceCheckout'));
const OmniaLiveEntitlements = lazy(() => import('./pages/omnia-live/commerce/OmniaLiveEntitlements'));
const OrganizerPayouts = lazy(() => import('./pages/omnia-live/commerce/OrganizerPayouts'));
const AdminOmniaLiveCommerce = lazy(() => import('./pages/omnia-live/commerce/AdminOmniaLiveCommerce'));
const MyLiveDocuments = lazy(() => import('./pages/omnia-live/documents/MyLiveDocuments'));
const VerifyLiveDocument = lazy(() => import('./pages/omnia-live/documents/VerifyLiveDocument'));
const AdminLiveDocuments = lazy(() => import('./pages/omnia-live/documents/AdminLiveDocuments'));
const EventDocumentSettings = lazy(() => import('./pages/omnia-live/documents/EventDocumentSettings'));
const OrganizerCommunications = lazy(() => import('./pages/omnia-live/organizer/OrganizerCommunications'));
const OrganizerAccessCodes = lazy(() => import('./pages/omnia-live/organizer/OrganizerAccessCodes'));
const AdminOmniaLiveCommunications = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveCommunications'));
const AdminOmniaLiveAutomationRules = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveAutomationRules'));
const OrganizerAnalyticsAdvanced = lazy(() => import('./pages/omnia-live/analytics/OrganizerAnalyticsAdvanced'));
const AdminOmniaLiveAnalytics = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveAnalytics'));
const AdminOmniaLiveReports = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveReports'));
const StructureOmniaLiveReports = lazy(() => import('./pages/omnia-live/structure/StructureOmniaLiveReports'));
const AdminOmniaLiveSecurity = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveSecurity'));
const AdminOmniaLiveIntegrity = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveIntegrity'));
const AdminOmniaLiveAudit = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveAudit'));
const OmniaLiveSystemStatus = lazy(() => import('./pages/omnia-live/system/OmniaLiveSystemStatus'));
const OmniaLiveWatch = lazy(() => import('./pages/omnia-live/OmniaLiveWatch'));
const ProjectsHome = lazy(() => import('./pages/projects/ProjectsHome'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const PublicProjectPortfolio = lazy(() => import('./pages/projects/PublicProjectPortfolio'));
const ProjectsWorkspace = lazy(() => import('./pages/projects/ProjectsWorkspace'));
const ProjectOwnerWorkspace = lazy(() => import('./pages/projects/ProjectOwnerWorkspace'));
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'));
const AdminOmniaLiveCreate = lazy(() => import('./pages/omnia-live/admin/AdminOmniaLiveCreate'));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }}
        />
        <p className="text-sm font-medium" style={{ color: '#002050' }}>Chargement…</p>
      </div>
    </div>
  );
}

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

interface AppErrorBoundaryState {
  hasError: boolean;
  recovering: boolean;
  reference: string;
}

function createErrorReference(): string {
  return `OGA-${Date.now().toString(36).toUpperCase()}`;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, recovering: false, reference: '' };

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const reference = createErrorReference();
    captureError(error, { componentStack: info.componentStack, reference });
    this.setState({ reference });

    if (isRecoverableChunkError(error)) {
      this.setState({ recovering: true });
      void recoverFromChunkError().then(reloading => {
        if (!reloading) this.setState({ recovering: false });
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.recovering) {
        return (
          <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
            <section className="w-full max-w-lg text-center">
              <div
                aria-hidden="true"
                className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }}
              />
              <h1 className="mt-6 text-2xl font-bold text-[#002050]">Mise à jour de la plateforme</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Une nouvelle version est disponible. Omnia recharge les fichiers nécessaires automatiquement.
              </p>
            </section>
          </main>
        );
      }

      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
          <section className="w-full max-w-xl border-t-4 border-[#BF8813] bg-white px-6 py-10 text-center shadow-sm sm:px-10">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mx-auto h-12 w-12 text-[#BF8813]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <h1 className="mt-5 text-2xl font-bold text-[#002050]">La page n’a pas pu être affichée</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Rechargez la page. Si le problème persiste, revenez à l’accueil et communiquez la référence ci-dessous au support.
            </p>
            {this.state.reference && (
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Référence : {this.state.reference}
              </p>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#002050] px-5 py-3 text-sm font-semibold text-white hover:bg-[#00183d]"
              >
                Recharger la page
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/accueil')}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-[#002050] hover:bg-slate-50"
              >
                Retour à l’accueil
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <SiteModeProvider>
        <MaintenanceNoticeBanner />
        <MobileNotificationBridge />
        <MobileStoreRecoveryBridge />
        <PreviewReturnButton />
        <PlatformRoleGate>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
        <Route path="/" element={<RootGate />} />
        <Route path="/accueil" element={<LandingPage />} />
        <Route path="/home" element={<ConnectedHome />} />
        <Route path="/newsletter" element={<NewsletterPreferencesPage />} />
          <Route path="/career-studio" element={<OmniaCareerStudio />} />
          <Route path="/projects" element={<ProjectsHome />} />
          <Route path="/projects/explorer" element={<ProjectsHome />} />
          <Route path="/projects/mes-projets" element={<ProjectsWorkspace />} />
          <Route path="/projects/gestion" element={<ProjectOwnerWorkspace />} />
          <Route path="/professeur/projects" element={<ProjectOwnerWorkspace />} />
          <Route path="/structure/projects" element={<ProjectOwnerWorkspace />} />
          <Route path="/admin/projects" element={<AdminProjects />} />
          <Route path="/admin/projects/gestion" element={<ProjectOwnerWorkspace />} />
          <Route path="/portfolio/projects/:userId" element={<PublicProjectPortfolio />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/coaching" element={<CoachingCatalogue />} />
          <Route path="/credentials/badges/:credentialId" element={<PublicBadgeVerification />} />
          <Route path="/credentials/pathways/:verificationCode" element={<ProfessionalPathwayCredentialVerify />} />
          <Route path="/assessment/jury/:inviteToken" element={<AssessmentJuryAccess />} />
          <Route path="/credentials/clr/:shareToken" element={<PublicClrShare />} />
          <Route path="/credentials/passports/:shareToken" element={<PublicSkillsPassport />} />
          <Route path="/coaching/coachs/:coachId" element={<CoachingCoachProfile />} />
          <Route path="/coaching/coachs/:coachId/reserver" element={<CoachingBooking />} />
          <Route path="/coaching/paiement/:sessionId" element={<CoachingPayment />} />
          <Route path="/coaching/devenir-coach" element={<CoachApplication />} />
          <Route path="/dashboard/coaching" element={<LearnerCoachingDashboard />} />
          <Route path="/coaching/solutions" element={<CoachingAdvancedHub />} />
          <Route path="/dashboard/coaching/avance" element={<CoachingAdvancedHub />} />
          <Route path="/coaching/avance/paiement/:orderId" element={<CoachingAdvancedPayment />} />
          <Route path="/coaching/groupes/:programId/room" element={<CoachingGroupRoom />} />
          <Route path="/coaching/sessions/:sessionId/room" element={<CoachingSessionRoom />} />
          <Route path="/coaching/sessions/:sessionId/suivi" element={<CoachingSessionFollowUp />} />
          <Route path="/dashboard/coaching/sessions/:sessionId/suivi" element={<CoachingSessionFollowUp />} />
          <Route path="/coach/dashboard" element={<CoachDashboard />} />
          <Route path="/coach/offres" element={<CoachOffers />} />
          <Route path="/coach/calendrier" element={<CoachCalendar />} />
          <Route path="/coach/sessions" element={<CoachSessions />} />
          <Route path="/coach/avis" element={<CoachReviews />} />
          <Route path="/coach/revenus" element={<CoachRevenue />} />
          <Route path="/coach/produits" element={<CoachAdvancedProducts />} />
          <Route path="/coach/commerce" element={<CreatorCommerce moduleKey="coaching" />} />
          <Route path="/coach/plan-omnia" element={<CommerceCatalog audience="coach" />} />
          <Route path="/talents" element={<TalentDirectory />} />
          <Route path="/talent" element={<TalentHome />} />
          <Route path="/talent/explorer" element={<TalentExplore />} />
          <Route path="/talent/recruteurs" element={<TalentRecruiters />} />
          <Route path="/talent/recruteur/dashboard" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/offres" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/talents" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/competences-verifiees" element={<VerifiedTalentCandidates />} />
          <Route path="/talent/recruteur/competences-verifiees/:userId" element={<VerifiedTalentCandidateDetail />} />
          <Route path="/talent/recruteur/favoris" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/candidatures" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/entretiens" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/messages" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/profil" element={<Navigate to="/mon-profil" replace />} />
          <Route path="/talent/recruteur/parametres" element={<RecruiterDashboard />} />
          <Route path="/talent/recruteur/plans" element={<CommerceCatalog audience="recruiter" />} />
          <Route path="/talent/organisations" element={<TalentOrganisations />} />
          <Route path="/talent/a-propos" element={<TalentAbout />} />
          <Route path="/talent/profil/:profileId" element={<TalentProfilePublic />} />
          <Route path="/omnia-live" element={<OmniaLiveHome />} />
          <Route path="/omnia-live/en-direct" element={<CatalogView title="En direct maintenant" subtitle="Les sessions actuellement ouvertes apparaissent ici en temps réel." filter="live" />} />
          <Route path="/omnia-live/a-venir" element={<CatalogView title="Lives à venir" subtitle="Découvrez les prochains événements et consultez les horaires dans votre fuseau local." filter="upcoming" />} />
          <Route path="/omnia-live/explorer" element={<CatalogView title="Explorer Omnia Live" subtitle="Explorez les Lives, masterclass, ateliers, conférences et contenus disponibles." />} />
          <Route path="/omnia-live/formations" element={<CatalogView title="Formations Live" subtitle="Des formations synchrones structurées en plusieurs classes et sessions." filter="training" />} />
          <Route path="/omnia-live/videos" element={<CatalogView title="Vidéos & Replays" subtitle="Masterclass enregistrées, vidéos à la demande et replays validés par Omnia." filter="video" />} />
          <Route path="/omnia-live/replays" element={<Navigate to="/omnia-live/videos" replace />} />
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
          <Route path="/admin/omnia-live/remboursements" element={<AdminOmniaLiveOperations initialTab="refunds" />} />
          <Route path="/omnia-live/:liveId/avis" element={<OmniaLiveReviews />} />
          <Route path="/omnia-live/revenus" element={<OmniaLiveOrganizerFinance />} />
          <Route path="/admin/omnia-live/annulations" element={<AdminOmniaLiveOperations initialTab="cancellations" />} />
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
          <Route path="/omnia-live/notifications" element={<Navigate to="/omnia-live/participant/notifications" replace />} />
          <Route path="/omnia-live/participant/remboursements" element={<ParticipantRefunds />} />
          <Route path="/omnia-live/organisateur" element={<OrganizerDashboard />} />
          <Route path="/omnia-live/organisateur/evenements" element={<OrganizerEvents />} />
          <Route path="/omnia-live/organisateur/evenements/:eventId" element={<OrganizerEventDetail />} />
          <Route path="/omnia-live/organisateur/participants" element={<OrganizerParticipants />} />
          <Route path="/omnia-live/organisateur/medias" element={<OrganizerMedia />} />
          <Route path="/omnia-live/organisateur/statistiques" element={<OrganizerAnalytics />} />
          <Route path="/omnia-live/organisateur/parametres" element={<OrganizerSettings />} />
          <Route path="/omnia-live/organisateur/offres" element={<CreatorCommerce moduleKey="omnia_live" />} />
          <Route path="/omnia-live/organisateur/plan-omnia" element={<CommerceCatalog audience="organizer" />} />
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
          <Route path="/admin/quality-center" element={<AdminQualityCenter />} />
          <Route path="/admin/recognition-hub" element={<AdminRecognitionHub />} />
        <Route path="/admin/professional-pathways" element={<AdminProfessionalPathways />} />
        <Route path="/admin/employabilite" element={<AdminEmployabilityIntegration />} />
          <Route path="/admin/assessment-center" element={<AdminAssessmentCenter />} />
          <Route path="/admin/assessment-governance" element={<AdminAssessmentGovernance />} />
          <Route path="/admin/studio-validation" element={<Navigate to="/admin/quality-center" replace />} />
              <Route path="/admin/course-pricing" element={<AdminCoursePricing />} />
          <Route path="/admin/course-health" element={<Navigate to="/admin/quality-center" replace />} />

        {/* Auth — always accessible even in coming-soon mode */}
        <Route path="/connexion" element={<Login />} />
        <Route path="/connexion-rapide" element={<LoginOTP />} />
        <Route path="/inscription" element={<SelectRole />} />
        <Route path="/inscription/apprenant" element={<RegisterApprenant />} />
        <Route path="/invitation/:token" element={<AccessInvitationPage />} />
        <Route path="/inscription/professeur" element={<RegisterProfesseur />} />
          <Route path="/inscription/organisateur" element={<RegisterOrganizer />} />
          <Route path="/inscription/recruteur" element={<RegisterRecruiterIndependent />} />
          <Route path="/inscription/structure" element={<RegisterStructure />} />
          <Route path="/inscription/organisation" element={<Navigate to="/inscription/structure" replace />} />
        <Route path="/verifier-otp" element={<VerifyOTP />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/en-attente-validation" element={<PendingValidation />} />
        <Route path="/changer-mot-de-passe" element={<ForcePasswordChange />} />

        {/* Admin — always accessible */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/dashboard/roles/:roleKey" element={<AdminRoleUsers />} />
        <Route path="/admin/utilisateurs" element={<AdminUsers />} />
        <Route path="/admin/utilisateurs/:userId" element={<AdminUserDetail />} />
        <Route path="/admin/dashboard/activity-today" element={<AdminActivityToday />} />
        <Route path="/admin/suppressions" element={<AdminDeletionRequests />} />
        <Route path="/admin/profil" element={<Navigate to="/mon-profil" replace />} />
        <Route path="/admin/talent" element={<AdminTalent />} />
        <Route path="/admin/coaching" element={<AdminCoaching />} />
        <Route path="/admin/coaching/candidatures" element={<AdminCoaching />} />
        <Route path="/admin/coaching/coachs" element={<AdminCoaching />} />
        <Route path="/admin/coaching/niveaux" element={<AdminCoaching />} />
        <Route path="/admin/coaching/domaines" element={<AdminCoaching />} />
        <Route path="/admin/coaching/offres" element={<AdminCoachingOffers />} />
        <Route path="/admin/coaching/finance" element={<AdminCoachingFinance />} />
        <Route path="/admin/coaching/sessions" element={<AdminCoachingSessions />} />
        <Route path="/admin/coaching/litiges" element={<AdminCoachingDisputes />} />
        <Route path="/admin/coaching/avis" element={<AdminCoachingRatings />} />
        <Route path="/admin/coaching/revenus" element={<AdminCoachingRevenue />} />
        <Route path="/admin/coaching/avance" element={<AdminCoachingAdvanced />} />
        <Route path="/admin/career-studio/details/:metric" element={<AdminCareerStudioDetail />} />
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
        <Route path="/admin/traductions" element={<AdminTranslations />} />
        <Route path="/admin/cms-branding/preview" element={<LandingDraftPreview />} />
        <Route path="/admin/fintech" element={<AdminFintech />} />
        <Route path="/admin/monetization" element={<AdminMonetization />} />
        <Route path="/admin/payouts" element={<AdminRetraits />} />
        <Route path="/admin/marketing" element={<AdminMarketing />} />
        <Route path="/admin/courses" element={<AdminCatalogue />} />
        <Route path="/admin/courses/new" element={<Navigate to="/admin/studio/new" replace />} />
        <Route path="/admin/courses/import" element={<ProfessorCourseStart />} />
        <Route path="/admin/courses/:id/edit" element={<StudioConceptionFormation />} />
        <Route path="/admin/team" element={<AdminEquipe />} />
        <Route path="/admin/special-access" element={<AdminDemoAccess />} />
        <Route path="/admin/demo-access" element={<Navigate to="/admin/special-access" replace />} />
        <Route path="/admin/cpd-credits" element={<AdminCpdCredits />} />
          <Route path="/admin/certificates" element={<AdminCertificates />} />
<Route path="/admin/certificate-settings" element={<AdminCertificateSettings />} />
          <Route path="/admin/certificate-templates" element={<AdminCertificateTemplates />} />
          <Route path="/admin/certificate-preview" element={<AdminCertificatePreview />} />
          <Route path="/admin/credentials" element={<AdminCredentials />} />
          <Route path="/admin/credentials/modeles" element={<AdminCredentials />} />
          <Route path="/admin/credentials/attributions" element={<AdminCredentials />} />
          <Route path="/admin/credentials/emetteurs" element={<AdminCredentials />} />
          <Route path="/admin/credentials/signatures" element={<AdminCredentials />} />
          <Route path="/admin/credentials/categories" element={<AdminCredentials />} />
          <Route path="/admin/credentials/clr" element={<AdminCredentials />} />
          <Route path="/admin/credentials/passports" element={<AdminCredentials />} />
          <Route path="/admin/credentials/revocations" element={<AdminCredentials />} />
          <Route path="/admin/studio-mes-formations" element={<AdminMesFormations />} />
          <Route path="/admin/structures" element={<AdminStructures />} />
<Route path="/admin/structure-codes" element={<AdminStructureCodes />} />
<Route path="/admin/structures/b2b" element={<AdminStructureB2B />} />
          
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
        <Route path="/moderator/missions" element={<ModerateurMissions />} />
        <Route path="/moderateur/missions" element={<ModerateurMissions />} />

        {/* Profil utilisateur unifié — tous les rôles */}
        <Route path="/mon-profil" element={<UnifiedProfilePage />} />
        <Route path="/profil/:userId" element={<PublicProfilePage />} />
        <Route path="/moderator/profile" element={<Navigate to="/mon-profil" replace />} />
        <Route path="/moderateur/profil" element={<Navigate to="/mon-profil" replace />} />
        <Route path="/structure/mon-profil" element={<Navigate to="/mon-profil" replace />} />
        <Route path="/coach/profil" element={<Navigate to="/mon-profil" replace />} />
        <Route path="/omnia-live/organisateur/profil" element={<Navigate to="/mon-profil" replace />} />

        {/* Module 6 — Dashboard apprenant — always accessible */}
        <Route path="/dashboard" element={<DashboardApprenant />} />
        <Route path="/dashboard/mes-cours" element={<DashboardMesCours />} />
        <Route path="/dashboard/abonnements" element={<CommerceCatalog audience="learner" />} />
        <Route path="/dashboard/evaluations" element={<DashboardAssessments />} />
        <Route path="/dashboard/evaluations/session/:sessionId" element={<AssessmentSession />} />
        <Route path="/dashboard/certificats" element={<DashboardCertificats />} />
        <Route path="/dashboard/badges" element={<DashboardBadges />} />
        <Route path="/dashboard/learning-record" element={<DashboardLearningRecord />} />
        <Route path="/dashboard/skills-passport" element={<DashboardSkillsPassport />} />
        <Route path="/dashboard/project-portfolio" element={<DashboardProjectPortfolio />} />
          <Route path="/dashboard/professional-pathways" element={<DashboardProfessionalPathways />} />
        <Route path="/dashboard/employabilite" element={<DashboardEmployability />} />
          <Route path="/dashboard/career-studio" element={<DashboardCareerStudio />} />
          <Route path="/dashboard/career-studio/editor/:docId" element={<CareerStudioEditor />} />
        <Route path="/dashboard/career-studio/editor/new" element={<CareerStudioEditor />} />
        <Route path="/dashboard/parrainage" element={<DashboardParrainage />} />
        <Route path="/dashboard/profil" element={<Navigate to="/mon-profil" replace />} />
          <Route path="/dashboard/structure" element={<DashboardStructure />} />

        {/* Espace Professeur */}
        <Route path="/professeur/dashboard" element={<DashboardProfesseur />} />
        <Route path="/professeur/courses" element={<ProfesseurMesFormations />} />
        <Route path="/professeur/courses/new" element={<ProfessorCourseStart />} />
        <Route path="/professeur/assessment-center" element={<ProfesseurAssessmentCenter />} />
        <Route path="/professeur/jurys" element={<ProfesseurJuries />} />
        <Route path="/professeur/courses/:id/edit" element={<StudioConceptionFormation />} />
          <Route path="/professeur/studio/new" element={<StudioConceptionFormation />} />
<Route path="/professeur/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/partner/studio/new" element={<StudioConceptionFormation />} />
<Route path="/partner/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/partner/recognitions" element={<PartnerRecognitionWorkspace />} />
<Route path="/admin/studio/new" element={<StudioConceptionFormation />} />
<Route path="/admin/studio/:courseId" element={<StudioConceptionFormation />} />
        <Route path="/admin/studio/:courseId/evaluations" element={<StudioEvaluations />} />
        <Route path="/professeur/studio/:courseId/evaluations" element={<StudioEvaluations />} />
        <Route path="/structure/studio/:courseId/evaluations" element={<StudioEvaluations />} />
<Route path="/structure/studio/new" element={<StudioConceptionFormation />} />
<Route path="/structure/assessment-center" element={<ProfesseurAssessmentCenter />} />
<Route path="/structure/jurys" element={<ProfesseurJuries />} />
<Route path="/structure/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/structure/courses/new" element={<ProfessorCourseStart />} />
<Route path="/structure/formations/nouvelle" element={<Navigate to="/structure/courses/new" replace />} />

        <Route path="/professeur/payouts" element={<ProfesseurPortefeuille />} />
        <Route path="/professeur/analytics" element={<ProfesseurAnalytique />} />
        <Route path="/professeur/profile" element={<Navigate to="/mon-profil" replace />} />
        <Route path="/professeur/dossier-professionnel" element={<ProfesseurProfil />} />
          <Route path="/professeur/certificats" element={<ProfesseurCertificats />} />

        {/* Espace Structure */}
          <Route path="/structure/dashboard" element={<StructureDashboard />} />
          <Route path="/structure/formations" element={<StructureMesFormations />} />
          <Route path="/structure/profil" element={<StructureProfil />} />
<Route path="/structure/codes" element={<StructureCodes />} />
<Route path="/structure/membres" element={<StructureMembres />} />
<Route path="/structure/rattachements" element={<StructureMembres />} />
<Route path="/structure/demandes" element={<Navigate to="/structure/rattachements" replace />} />
<Route path="/structure/statistiques" element={<Navigate to="/structure/suivi-rh" replace />} />
<Route path="/structure/notifications" element={<Navigate to="/mon-profil?tab=notifications" replace />} />
<Route path="/structure/parametres" element={<Navigate to="/mon-profil?tab=visibilite" replace />} />
<Route path="/structure/abonnements" element={<CommerceCatalog audience="structure" />} />
<Route path="/structure/commerce-b2b" element={<StructureB2B />} />
<Route path="/structure/organisation" element={<StructureOrganisation />} />
<Route path="/structure/suivi-rh" element={<StructureRHConformite />} />
<Route path="/structure/equipe" element={<StructureEquipe />} />
<Route path="/structure/offres-emploi" element={<StructureJobs />} />
<Route path="/structure/recrutement/dashboard" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/offres" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/talents" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/competences-verifiees" element={<VerifiedTalentCandidates />} />
<Route path="/structure/recrutement/competences-verifiees/:userId" element={<VerifiedTalentCandidateDetail />} />
<Route path="/structure/recrutement/favoris" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/candidats" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/entretiens" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/messages" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/statistiques" element={<StructureRecruitment />} />
<Route path="/structure/recrutement/equipe" element={<StructureRecruitment />} />

        {/* Compatibilité des anciennes URL Établissement : aucun ancien Dashboard n'est monté. */}
        <Route path="/staff/*" element={<Navigate to="/professeur/dashboard" replace />} />
        <Route path="/school/*" element={<Navigate to="/structure/dashboard" replace />} />

        {/* Module 11 — Paiement — always accessible */}
        <Route path="/paiement/:courseId" element={<Checkout />} />
        <Route path="/paiement/confirmation" element={<PaymentConfirmation />} />
        <Route path="/paiement/echec" element={<PaymentFailed />} />

        {/* Reconnaissances professionnelles — accès public */}
        <Route path="/cpd" element={<CpdPage />} />

        {/* Module 14 — Omnia Communauté & Carrière — always accessible */}
        <Route path="/forum" element={<Forum />} />
        <Route path="/forum/general" element={<ForumGeneral />} />
        <Route path="/forum/carriere" element={<ForumGeneral />} />
        <Route path="/forum/post/:postId" element={<ForumPost />} />
        <Route path="/forum/formations" element={<CommunityCourseForums />} />
        <Route path="/forum/cours/:courseId" element={<ForumCours />} />
        <Route path="/forum/emploi" element={<EspaceCarriere />} />
        <Route path="/forum/emploi/:jobId" element={<JobDetail />} />
        <Route path="/emploi" element={<Navigate to="/forum/emploi" replace />} />
        <Route path="/emploi/:jobId" element={<LegacyJobRedirect />} />

<Route element={<RequireOmniaCareerLearner />}>
  <Route path="/omnia-career" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/cv-builder" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/lettres" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/entretien" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/candidatures" element={<DashboardCareerStudio />} />
  <Route path="/omnia-career/profil" element={<Navigate to="/mon-profil?tab=professionnel" replace />} />
  <Route path="/omnia-career/coaching" element={<Navigate to="/coaching" replace />} />
  <Route path="/omnia-career/parametres" element={<DashboardCareerStudio />} />
</Route>

<Route element={<RequireOmniaCareerAdmin />}>
  <Route path="/admin/omnia-career" element={<Navigate to="/admin/career-studio" replace />} />
</Route>

        {/* Account deletion must remain publicly reachable for store compliance. */}
        <Route path="/supprimer-compte" element={<SupprimerCompte />} />
        <Route path="/compte-supprime" element={<CompteSupprime />} />

        {/* Public routes guarded by coming-soon mode */}
        <Route element={<GuardedRoutes />}>
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/pour-les-apprenants" element={<AudienceRolePage audienceKey="apprenants" />} />
        <Route path="/pour-les-professeurs" element={<AudienceRolePage audienceKey="professeurs" />} />
        <Route path="/pour-les-structures" element={<AudienceRolePage audienceKey="structures" />} />
        <Route path="/pour-les-recruteurs" element={<AudienceRolePage audienceKey="recruteurs" />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
              <Route path="/cgu" element={<LegalDocumentPage />} />
              <Route path="/mentions-legales" element={<LegalDocumentPage />} />
              <Route path="/cookies" element={<LegalDocumentPage />} />
              <Route path="/cgv" element={<LegalDocumentPage />} />
              <Route path="/remboursements" element={<LegalDocumentPage />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/formation-externe/:id" element={<ExternalCourseAccess />} />
        <Route path="/cours/:id/apercu" element={<ApercuGratuit />} />
        <Route path="/cours/:id" element={<CoursDetail />} />
        <Route path="/cours/:id/apprendre/:lessonId" element={<CoursLecteur />} />
        <Route path="/cours/:id/apprendre" element={<CoursLecteur />} />
        <Route path="/cours/:id/examen-module/:moduleId" element={<ExamenModule />} />
        <Route path="/cours/:id/validation-finale" element={<ValidationFinale />} />
        </Route>{/* end GuardedRoutes */}
        <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </PlatformRoleGate>
        </SiteModeProvider>
        <PwaInstallBanner />
        <NetworkStatusBanner />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}