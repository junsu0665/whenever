import { Profile } from '../types';
import { supabase } from './supabase';

interface VerificationSubmission {
  displayUri: string;
  storagePath: string;
}

export async function submitStudentVerification(profile: Profile, imageUri: string): Promise<VerificationSubmission> {
  if (!supabase) {
    return { displayUri: imageUri, storagePath: imageUri };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인 상태를 확인하지 못했어요. 다시 로그인한 뒤 시도해 주세요.');
  }

  const response = await fetch(imageUri);
  const blob = await response.blob();
  const storagePath = `${user.id}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage.from('student-id-cards').upload(storagePath, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { error: rowError } = await supabase.from('student_verifications').insert({
    user_id: user.id,
    school_id: profile.schoolId,
    storage_path: storagePath,
    status: 'pending',
  });

  if (rowError) {
    throw rowError;
  }

  return { displayUri: imageUri, storagePath };
}
