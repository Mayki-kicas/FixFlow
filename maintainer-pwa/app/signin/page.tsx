export default function SigninPage() {
  return (
    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded p-4">
      <h1 className="text-lg font-semibold">Connexion mainteneur</h1>
      <p className="text-xs text-slate-500 mt-1">
        MVP: auth locale mainteneur a brancher (magic link / OTP / mot de passe).
      </p>
      <form className="mt-3 space-y-3">
        <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded" placeholder="Email" />
        <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded" placeholder="Code OTP" />
        <button type="button" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">Se connecter</button>
      </form>
    </div>
  );
}
