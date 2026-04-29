import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile 
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Target, Mail, Lock, User, ArrowRight, UserCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      toast.error("Error al conectar con Google");
    }
  };

  const handleAnonymousLogin = async () => {
    setLoading(true);
    const toastId = toast.loading("Entrando como invitado...");
    try {
      await signInAnonymously(auth);
      toast.success("Entrando como invitado (Sin cuenta)", { id: toastId });
    } catch (error: any) {
      console.error("Anonymous auth error", error);
      toast.error("El modo invitado no está habilitado en Firebase", { id: toastId });
      if (error.code === 'auth/operation-not-allowed') setShowConfigHelp(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(isLogin ? "Iniciando sesión..." : "Creando cuenta...");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("¡Bienvenido de nuevo!", { id: toastId });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
        toast.success("¡Cuenta creada! Entrando...", { id: toastId });
      }
    } catch (error: any) {
      console.error("Auth error", error);
      let message = "Error en la autenticación";
      if (error.code === 'auth/email-already-in-use') message = "El correo ya está en uso";
      if (error.code === 'auth/wrong-password') message = "Contraseña incorrecta";
      if (error.code === 'auth/user-not-found') message = "Usuario no encontrado";
      if (error.code === 'auth/weak-password') message = "La contraseña es muy débil";
      if (error.code === 'auth/invalid-email') message = "El correo electrónico no es válido";
      if (error.code === 'auth/operation-not-allowed') {
        message = "Acción requerida en Firebase Console";
        setShowConfigHelp(true);
      }
      toast.error(message, { id: toastId, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface text-white safe-top safe-bottom">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm space-y-6 sm:space-y-8"
      >
        {/* Help Panel for Firebase Config */}
        <AnimatePresence>
          {showConfigHelp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-brand-blue/10 border border-brand-blue/30 rounded-2xl p-5 space-y-4 mb-4"
            >
              <div className="flex items-center gap-2 text-brand-blue">
                <AlertCircle size={20} />
                <h3 className="font-bold text-sm">Configuración Requerida</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Para permitir el acceso sin Google, debes habilitar el proveedor en tu consola de Firebase 
                (solo toma 10 segundos):
              </p>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                <li>Ve a <b>Authentication</b> en Firebase</li>
                <li>Pestaña <b>Sign-in method</b></li>
                <li>Habilita <b>Correo electrónico/contraseña</b></li>
                <li>Habilita <b>Anónimo</b> (para Modo Invitado)</li>
              </ol>
              <a 
                href="https://console.firebase.google.com/" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 bg-brand-blue/20 hover:bg-brand-blue/30 rounded-xl text-brand-blue text-[10px] font-bold uppercase transition-all"
              >
                Abrir Consola de Firebase <ExternalLink size={12} />
              </a>
              <button 
                onClick={() => setShowConfigHelp(false)}
                className="w-full text-center text-[9px] text-text-muted hover:text-white uppercase font-bold"
              >
                Cerrar este aviso
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 bg-brand-blue rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-brand-blue/30 relative z-10">
              <Target size={40} className="text-white" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-brand-blue/20 rounded-full blur-3xl"></div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tighter text-white">Nowy</h1>
            <p className="text-text-muted text-xs uppercase tracking-widest font-bold">
              {isLogin ? 'Inicia sesión en el sistema' : 'Crea tu protocolo de hábitos'}
            </p>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="relative overflow-hidden"
              >
                <User className="absolute left-4 top-4 text-text-muted" size={18} />
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-card-bg border border-card-border rounded-2xl py-4 pl-12 pr-4 focus:border-brand-blue outline-none transition-all placeholder:text-text-muted/50 font-medium"
                  required={!isLogin}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-4 top-4 text-text-muted" size={18} />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-2xl py-4 pl-12 pr-4 focus:border-brand-blue outline-none transition-all placeholder:text-text-muted/50 font-medium"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-4 text-text-muted" size={18} />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-2xl py-4 pl-12 pr-4 focus:border-brand-blue outline-none transition-all placeholder:text-text-muted/50 font-medium"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-brand-blue/90 active:scale-95 transition-all shadow-lg shadow-brand-blue/20"
          >
            {loading ? 'Procesando...' : isLogin ? 'Entrar' : 'Registrarse'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-card-border"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold text-text-muted bg-surface px-4">O continúa con</div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 invert" alt="Google" />
          <span className="font-bold text-sm">Google Account</span>
        </button>

        <button
          onClick={handleAnonymousLogin}
          disabled={loading}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-brand-green/10 border border-brand-green/20 hover:bg-brand-green/20 transition-all text-brand-green"
        >
          <UserCircle size={18} />
          <span className="font-bold text-sm">Entrar como Invitado</span>
        </button>

        <div className="text-center pt-2">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-brand-blue hover:underline"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate gratis' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>

        <div className="flex justify-center gap-2 pt-4">
          <div className="badge badge-sync text-[9px] px-2 py-0.5 bg-brand-green/10 text-brand-green border border-brand-green/20 rounded-full uppercase font-bold">Secure ProtocoL</div>
          <div className="badge badge-sync text-[9px] px-2 py-0.5 bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full uppercase font-bold">Neural Sync</div>
        </div>
      </motion.div>
    </div>
  );
}

