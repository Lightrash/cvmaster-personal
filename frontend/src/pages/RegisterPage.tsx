import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!fullName.trim() || !email.trim() || !password) return;

    if (password.length < 6) {
      setLocalError('Password must contain at least 6 characters');
      return;
    }

    try {
      await register(fullName.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch {
      // handled by store error state
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f3f4] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-[#f7f7f8] dark:bg-neutral-900 px-6 flex items-center justify-between transition-colors duration-300">
        <span className="text-[34px] leading-none font-medium tracking-tight">LOGO</span>

        <button
          onClick={toggleTheme}
          className="relative p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-300 cursor-pointer"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <div className="relative w-4 h-4">
            <Sun
              className={`w-4 h-4 text-amber-500 transition-all duration-300 absolute inset-0 ${
                theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
              }`}
            />
            <Moon
              className={`w-4 h-4 text-blue-400 transition-all duration-300 absolute inset-0 ${
                theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
              }`}
            />
          </div>
        </button>
      </header>

      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-8">
        <section className="w-full max-w-[620px] rounded-[34px] border border-neutral-300 dark:border-neutral-700 bg-[#f5f5f6] dark:bg-neutral-900 px-8 py-9 sm:px-12 sm:py-11 shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-colors duration-300">
          <div className="mb-7">
            <h1 className="text-[40px] leading-none font-semibold">Create an account</h1>
            <p className="mt-3 text-[20px] leading-7 text-neutral-500 dark:text-neutral-400">Enter your email below to create your account</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-[16px] font-medium text-neutral-900 dark:text-neutral-100">Full Name</label>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your Full Name"
                className="h-14 rounded-xl border-neutral-300 dark:border-neutral-700 bg-transparent text-[16px] placeholder:text-neutral-300 dark:placeholder:text-neutral-500"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[16px] font-medium text-neutral-900 dark:text-neutral-100">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="h-14 rounded-xl border-neutral-300 dark:border-neutral-700 bg-transparent text-[16px] placeholder:text-neutral-300 dark:placeholder:text-neutral-500"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[16px] font-medium text-neutral-900 dark:text-neutral-100">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-14 rounded-xl border-neutral-300 dark:border-neutral-700 bg-transparent text-[16px] placeholder:text-neutral-300 dark:placeholder:text-neutral-500"
                autoComplete="new-password"
              />
            </div>

            {(localError || error) && <p className="text-[14px] text-red-500">{localError || error}</p>}

            <Button
              type="submit"
              className="mt-1 h-14 w-full rounded-xl bg-[#3558d4] text-[18px] font-medium hover:bg-[#2f4fc3]"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Create an account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[16px] text-neutral-500 dark:text-neutral-400">
            Already have an account?{' '}
            <Link to="/login" className="text-neutral-500 dark:text-neutral-300 hover:text-neutral-700 dark:hover:text-neutral-100">
              Login
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
