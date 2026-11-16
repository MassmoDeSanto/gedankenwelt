/** Zeigt die aktuelle Rückmeldung am unteren Rand (siehe meldung.ts). */
import { schliesseMeldung, useMeldung } from './meldung';

export function Meldungsleiste() {
  const meldung = useMeldung();
  if (!meldung) return null;
  return (
    <div className="meldungsleiste" role="status" key={meldung.nr}>
      <span>{meldung.text}</span>
      {meldung.aktion && (
        <button
          onClick={() => {
            meldung.aktion!.tun();
            schliesseMeldung();
          }}
        >
          {meldung.aktion.text}
        </button>
      )}
    </div>
  );
}
