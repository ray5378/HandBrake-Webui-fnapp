import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle } from 'lucide-react';

function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const { checkInitialization, setupAdmin, login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const initialized = await checkInitialization();
        if (initialized === false) {
          setIsSetupMode(true);
        }
        setIsChecking(false);
      } catch {
        setIsChecking(false);
      }
    };
    check();
  }, [checkInitialization]);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    const result = await login(username, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '');
    }
  };

  const handleSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password || !confirmPassword) {
      setError(t('auth.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.fillAllFields'));
      return;
    }

    const result = await setupAdmin(username, password, confirmPassword);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '');
    }
  };

  if (isChecking) {
    return (
      <div className='min-h-screen bg-dark-900 flex items-center justify-center'>
        <Loader2 className='w-8 h-8 text-primary animate-spin' />
      </div>
    );
  }

  if (isSetupMode) {
    return (
      <div className='min-h-screen bg-dark-900 flex items-center justify-center px-4'>
        <div className='max-w-md w-full'>
          <div className='text-center mb-8'>
            <div className='w-20 h-20 mx-auto mb-4'>
              <img
                src='logo.png'
                alt={t('app.fullName', 'HandBrake Web UI')}
                className='w-full h-full object-contain'
              />
            </div>
            <h1 className='text-3xl font-bold text-white mb-2'>
              {t('app.fullName', 'HandBrake Web UI')}
            </h1>
            <p className='text-gray-400'>{t('auth.setupTitle')}</p>
          </div>

          <div className='bg-dark-800 rounded-xl p-8 shadow-xl'>
            {error && (
              <div className='mb-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-center space-x-2 text-error text-sm'>
                <AlertCircle className='w-4 h-4' />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSetupSubmit} className='space-y-4'>
              <div>
                <label className='label'>{t('auth.username')}</label>
                <input
                  type='text'
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className='input'
                  placeholder={t('auth.placeholderSetupUsername')}
                />
              </div>

              <div>
                <label className='label'>{t('auth.password')}</label>
                <input
                  type='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className='input'
                  placeholder={t('auth.placeholderSetupPassword')}
                />
              </div>

              <div>
                <label className='label'>{t('auth.confirmPassword')}</label>
                <input
                  type='password'
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className='input'
                  placeholder={t('auth.placeholderConfirmPassword')}
                />
              </div>

              <button
                type='submit'
                disabled={isLoading}
                className='btn btn-primary w-full flex items-center justify-center space-x-2'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <span>{t('auth.setupButton')}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-dark-900 flex items-center justify-center px-4'>
      <div className='max-w-md w-full'>
        <div className='text-center mb-8'>
          <div className='w-20 h-20 mx-auto mb-4'>
            <img
              src='logo.png'
              alt={t('app.fullName', 'HandBrake Web UI')}
              className='w-full h-full object-contain'
            />
          </div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            {t('app.fullName', 'HandBrake Web UI')}
          </h1>
          <p className='text-gray-400'>{t('auth.subtitle')}</p>
        </div>

        <div className='bg-dark-800 rounded-xl p-8 shadow-xl'>
          {error && (
            <div className='mb-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-center space-x-2 text-error text-sm'>
              <AlertCircle className='w-4 h-4' />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className='space-y-4'>
            <div>
              <label className='label'>{t('auth.username')}</label>
              <input
                type='text'
                value={username}
                onChange={e => setUsername(e.target.value)}
                className='input'
                placeholder={t('auth.placeholderUsername')}
              />
            </div>

            <div>
              <label className='label'>{t('auth.password')}</label>
              <input
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                className='input'
                placeholder={t('auth.placeholderPassword')}
              />
            </div>

            <button
              type='submit'
              disabled={isLoading}
              className='btn btn-primary w-full flex items-center justify-center space-x-2'
            >
              {isLoading ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <span>{t('auth.login')}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
