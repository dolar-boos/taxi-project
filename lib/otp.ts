import { supabase } from './supabase';

export const OTP_DEMO_MODE = true;
export const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 5;

export interface OtpResult {
  success: boolean;
  code?: string;
  demoMode: boolean;
  error?: string;
}

export interface VerifyResult {
  verified: boolean;
  error?: string;
}

function generateCode(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function sendSms(phone: string, code: string): Promise<boolean> {
  // TODO: integrate real SMS provider here when OTP_DEMO_MODE = false
  // Example:
  //   const res = await fetch(SMS_API_URL, { method: 'POST', body: JSON.stringify({ to: phone, message: `رمز التحقق: ${code}` }) });
  //   return res.ok;
  void phone;
  void code;
  return false;
}

export async function sendOtp(phone: string): Promise<OtpResult> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error: deleteError } = await supabase
    .from('otp_codes')
    .delete()
    .eq('phone', phone);
  if (deleteError) {
    return { success: false, demoMode: OTP_DEMO_MODE, error: 'فشل حذف الأكواد السابقة' };
  }

  const { error: insertError } = await supabase
    .from('otp_codes')
    .insert({
      phone,
      code,
      expires_at: expiresAt,
      used: false,
    });
  if (insertError) {
    return { success: false, demoMode: OTP_DEMO_MODE, error: 'فشل إنشاء رمز التحقق' };
  }

  if (OTP_DEMO_MODE) {
    console.log(`[OTP DEMO] code for ${phone}: ${code}`);
    return { success: true, code, demoMode: true };
  }

  const smsSent = await sendSms(phone, code);
  if (!smsSent) {
    console.error(`[OTP] SMS send failed for ${phone}`);
    return { success: false, demoMode: false, error: 'فشل إرسال SMS' };
  }
  return { success: true, demoMode: false };
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  const { data: record } = await supabase
    .from('otp_codes')
    .select('id, expires_at, used')
    .eq('phone', phone)
    .eq('code', code)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) {
    return { verified: false, error: 'الرمز غلط أو منتهي، اطلب رمز جديد' };
  }

  const now = new Date();
  const expires = new Date(record.expires_at);
  if (now > expires) {
    return { verified: false, error: 'الرمز غلط أو منتهي، اطلب رمز جديد' };
  }

  const { error: updateError } = await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('id', record.id);
  if (updateError) {
    return { verified: false, error: 'فشل التحقق من الرمز' };
  }

  return { verified: true };
}
