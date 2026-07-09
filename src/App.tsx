import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { RootGate } from './components/RootGate';
import { SiteModeProvider, useSiteMode } from './context/SiteModeContext';
import { LandingPage } from './pages/LandingPage';
import { APropos } from './pages/APropos';
import { Confidentialite } from './pages/Confidentialite';
import { Catalogue } from './pages/Catalogue';
import { CoursDetail } from './pages/CoursDetail';
import { ApercuGratuit } from './pages/ApercuGratuit';
import { CoursLecteur } from './pages/CoursLecteur';
import { ExamenModule } from './pages/ExamenModule';
import { ValidationFinale } from './pages/ValidationFinale';
import { SelectRole } from './pages/auth/SelectRole';
import { RegisterApprenant } from './pages/auth/RegisterApprenant';
import { RegisterProfesseur } from './pages/auth/RegisterProfesseur';
import { RegisterEtablissement } from './pages/auth/RegisterEtablissement';
import RegisterOrganisation from './pages/auth/RegisterOrganisation';
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
import DashboardCvBuilder from './pages/dashboard/DashboardCvBuilder';
import DashboardCareerStudio from './pages/dashboard/DashboardCareerStudio';
import CareerStudioEditor from './pages/dashboard/CareerStudioEditor';
import OmniaCareerStudio from './pages/OmniaCareerStudio';
import { DashboardParrainage } from './pages/dashboard/DashboardParrainage';
import { DashboardProfil } from './pages/dashboard/DashboardProfil';
import { DashboardProfesseur } from './pages/professeur/DashboardProfesseur';
import { ProfesseurMesFormations } from './pages/professeur/ProfesseurMesFormations';
import { ProfesseurStudioCreation } from './pages/professeur/ProfesseurStudioCreation';
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
import AdminStudioValidation from './pages/admin/AdminStudioValidation';
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
import StudioConceptionFormation from './pages/studio/StudioConceptionFormation';
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
import { LessonBlocksRenderer } from '../../components/BlockRenderer';

function GuardedRoutes() {
  const { comingSoon, loading } = useSiteMode();
  if (loading) return null;
  let isSuperAdmin = false;
  try {
    const stored = localStorage.getItem('omnia_user');
    isSuperAdmin = stored ? JSON.parse(stored)?.roles?.includes('super_admin') ?? false : false;
  } catch { /* ignore */ }
  if (comingSoon && !isSuperAdmin) return <Navigate to="/" replace />;
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
        <Routes>
        <Route path="/" element={<RootGate />} />
        <Route path="/accueil" element={<LandingPage />} />
          <Route path="/career-studio" element={<OmniaCareerStudio />} />
        <Route path="/recruteur" element={<FormulaireRecruteur />} />
        <Route path="/verify/:certificateId" element={<VerifyCertificate />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/demo/dashboard" element={<DemoDashboard />} />
          <Route path="/admin/studio-validation" element={<AdminStudioValidation />} />

        {/* Auth — always accessible even in coming-soon mode */}
        <Route path="/connexion" element={<Login />} />
        <Route path="/connexion-rapide" element={<LoginOTP />} />
        <Route path="/inscription" element={<SelectRole />} />
        <Route path="/inscription/apprenant" element={<RegisterApprenant />} />
        <Route path="/inscription/professeur" element={<RegisterProfesseur />} />
        <Route path="/inscription/etablissement" element={<RegisterEtablissement />} />
          <Route path="/inscription/organisation" element={<RegisterOrganisation />} />
        <Route path="/verifier-otp" element={<VerifyOTP />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/en-attente-validation" element={<PendingValidation />} />
        <Route path="/changer-mot-de-passe" element={<ForcePasswordChange />} />

        {/* Admin — always accessible */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/cms-branding" element={<AdminCMS />} />
        <Route path="/admin/fintech" element={<AdminFintech />} />
        <Route path="/admin/payouts" element={<AdminRetraits />} />
        <Route path="/admin/marketing" element={<AdminMarketing />} />
        <Route path="/admin/courses" element={<AdminCatalogue />} />
        <Route path="/admin/courses/new" element={<ProfesseurStudioCreation is_admin={true} />} />
        <Route path="/admin/courses/:id/edit" element={<ProfesseurStudioCreation is_admin={true} />} />
        <Route path="/admin/team" element={<AdminEquipe />} />
        <Route path="/admin/demo-access" element={<AdminDemoAccess />} />
        <Route path="/admin/cpd-credits" element={<AdminCpdCredits />} />
          <Route path="/admin/certificates" element={<AdminCertificates />} />
<Route path="/admin/certificate-settings" element={<AdminCertificateSettings />} />
          <Route path="/admin/certificate-preview" element={<AdminCertificatePreview />} />
          
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
        <Route path="/dashboard/cv-builder" element={<DashboardCvBuilder />} />
          <Route path="/dashboard/career-studio" element={<DashboardCareerStudio />} />
          <Route path="/dashboard/career-studio/editor/:docId" element={<CareerStudioEditor />} />
        <Route path="/dashboard/career-studio/editor/new" element={<CareerStudioEditor />} />
        <Route path="/dashboard/parrainage" element={<DashboardParrainage />} />
        <Route path="/dashboard/profil" element={<DashboardProfil />} />

        {/* Module 7 — Dashboard professeur — always accessible */}
        <Route path="/professeur/dashboard" element={<DashboardProfesseur />} />
        <Route path="/professeur/courses" element={<ProfesseurMesFormations />} />
        <Route path="/professeur/courses/new" element={<ProfesseurStudioCreation />} />
        <Route path="/professeur/courses/:id/edit" element={<ProfesseurStudioCreation />} />
          <Route path="/professeur/studio/new" element={<StudioConceptionFormation />} />
<Route path="/professeur/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/partner/studio/new" element={<StudioConceptionFormation />} />
<Route path="/partner/studio/:courseId" element={<StudioConceptionFormation />} />
<Route path="/admin/studio/new" element={<StudioConceptionFormation />} />
<Route path="/admin/studio/:courseId" element={<StudioConceptionFormation />} />
        <Route path="/professeur/payouts" element={<ProfesseurPortefeuille />} />
        <Route path="/professeur/analytics" element={<ProfesseurAnalytique />} />
        <Route path="/professeur/profile" element={<ProfesseurProfil />} />
          <Route path="/professeur/certificats" element={<ProfesseurCertificats />} />

        {/* Module 8 — Dashboard directeur — always accessible */}
        <Route path="/school/dashboard" element={<DirecteurDashboard />} />
          <Route path="/partner/dashboard" element={<PartnerDashboard />} />
          <Route path="/school/certificats" element={<DirecteurCertificats />} />
        <Route path="/school/teachers" element={<DirecteurEnseignants />} />
        <Route path="/school/courses" element={<DirecteurCatalogueInterne />} />
        <Route path="/school/licenses" element={<DirecteurLicences />} />
        <Route path="/school/payouts" element={<DirecteurPortefeuille />} />

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

        {/* Public routes guarded by coming-soon mode */}
        <Route element={<GuardedRoutes />}>
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
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
