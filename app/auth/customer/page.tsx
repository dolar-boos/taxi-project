'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Phone, Loader2 } from 'lucide-react';
import { useAuth, getOrCreateProfile } from '@/lib/auth-context';
import { sendOtp, verifyOtp, OTP_LENGTH, OTP_DEMO_MODE } from '@/lib/otp';
import { supabase } from '@/lib/supabase';

export default function CustomerAuthPage() {
  const router = useRouter();
  const { signIn, session, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && session?.role === 'customer') {
      router.push('/app/customer');
    }
  }, [authLoading, session, router]);

  const handleSendOtp = async () => {
    if (phone.length < 8) {
      toast.error('اكتب رقم موبايل صحيح');
      return;
    }
    setLoading(true);
    setDemoCode(null);
    try {
      const result = await sendOtp(phone);
      if (!result.success) {
        toast.error(result.error || 'ما زبط إرسال الرمز');
        return;
      }
      setSent(true);
      if (result.demoMode && result.code) {
        setDemoCode(result.code);
        toast.success('تم إنشاء رمز التحقق التجريبي');
      } else {
        toast.success('بعتنا لك رمز التحقق على رقمك');
      }
    } catch {
      toast.error('ما زبط إرسال الرمز - جرب مرة تانية');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== OTP_LENGTH) {
      toast.error(`اكتب ${OTP_LENGTH} أرقام`);
      return;
    }
    setLoading(true);
    try {
      const result = await verifyOtp(phone, code);
      if (!result.verified) {
        toast.error(result.error || 'رمز غلط');
        return;
      }

      const profile = await getOrCreateProfile(phone, 'customer');

      await supabase.from('wallets').upsert({
        phone,
        balance: 0,
      }, { onConflict: 'phone' });

      await signIn('customer', phone, undefined, profile?.id);
      toast.success('تم تسجيل الدخول');
      router.push('/app/customer');
    } catch {
      toast.error('ما زبط التحقق - جرب مرة تانية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 fon-gradient-gold rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-fon-black" />
          </div>
          <h1 className="text-2xl font-bold fon-text-gradient-gold">دخول الراكب</h1>
          <p className="text-sm text-fon-gold-dark mt-1">FOCUS ON-TAXI</p>
        </div>

        <div className="fon-card p-6 space-y-5">
          {!sent ? (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold-light mb-2">
                  <Phone className="w-4 h-4" /> رقم الجوال
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-fon-gold-dark px-3 py-3 bg-white/5 rounded-lg border border-fon-gold/20">+962</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7XXXXXXXX"
                    className="fon-input flex-1 px-4 py-3 text-sm"
                    dir="ltr"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  />
                </div>
              </div>
              <button onClick={handleSendOtp} disabled={loading} className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                إرسال رمز التحقق
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-fon-gold-dark mb-1">أرسلنا رمز التحقق إلى</p>
                <p className="text-sm text-fon-gold-light font-semibold" dir="ltr">+962{phone}</p>
              </div>

              {OTP_DEMO_MODE && demoCode && (
                <div className="rounded-xl border-2 border-dashed border-fon-gold/40 bg-fon-gold/10 p-4 text-center">
                  <p className="text-xs text-fon-gold-dark mb-1">الكود التجريبي - للتجربة فقط</p>
                  <p className="text-3xl font-black tracking-[0.3em] fon-text-gradient-gold" dir="ltr">{demoCode}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-fon-gold-light mb-2 block">رمز التحقق</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  placeholder={'•'.repeat(OTP_LENGTH)}
                  className="fon-input w-full px-4 py-3 text-center text-2xl tracking-widest"
                  dir="ltr"
                  maxLength={OTP_LENGTH}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  autoFocus
                />
              </div>
              <button onClick={handleVerify} disabled={loading} className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                تحقق ودخول
              </button>
              <button onClick={() => { setSent(false); setCode(''); setDemoCode(null); }} className="w-full text-xs text-fon-gold-dark hover:text-fon-gold transition">
                تغيير الرقم
              </button>
            </>
          )}
        </div>

        <div className="text-center mt-4 space-y-2">
          <button
            onClick={() => router.push('/')}
            className="w-full mt-6 bg-gradient-to-r from-[#C9A86A] to-[#E8D5A3] text-[#0A1931] py-3.5 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all"
          >
            ارجع للصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
