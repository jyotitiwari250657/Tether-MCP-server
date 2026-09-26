// FR-510, FR-701: Secrets Vault sidepanel view (Light Ribbon theme)
import { IconLock } from '../../components/icons.js';

export function VaultTab() {
  return (
    <div className="py-8 text-center space-y-3 flex flex-col items-center">
      {/* Lock icon in sunken well (Prompt 14 §3) */}
      <span className="w-12 h-12 rounded-card bg-sunken border border-line flex items-center justify-center text-text-700">
        <IconLock size={24} />
      </span>
      <h3 className="font-semibold text-text-900">Secrets Vault</h3>
      <p className="text-xs text-text-500 max-w-xs mx-auto">
        Zero-plaintext-at-rest credential vault with X25519 ECDH encrypted transport.
      </p>
      <span className="px-2 py-0.5 rounded-pill border text-[10px] font-bold bg-teal-tint border-teal-stroke text-teal-fg">
        IN USE
      </span>
    </div>
  );
}
