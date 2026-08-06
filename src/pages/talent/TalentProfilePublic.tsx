import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { logTalentProfileView } from './talentApi';

export default function TalentProfilePublic() {
  const { profileId = '' } = useParams();

  useEffect(() => {
    if (profileId) void logTalentProfileView(profileId);
  }, [profileId]);

  return <Navigate to={profileId ? `/profil/${profileId}` : '/talent/explorer'} replace />;
}
