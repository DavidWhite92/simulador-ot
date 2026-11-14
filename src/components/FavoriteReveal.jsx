import {favoriteComment} from "../lib/juryComments";
import {StaffBadge} from "./StaffSetup";
import { Button } from "./ui/button";
import { useMusicCue } from "../lib/audio";
import { motion as Motion, useReducedMotion } from "framer-motion";

export default function FavoriteReveal({ state, contestants, performances={}, onContinue }) {
  const reduceMotion = useReducedMotion();
  const order = state.top3RandomOrder || state.top3 || [];
  const count = state.top3RevealCount ?? (state.top3NamesRevealed ? 3 : 0);
  const favorite = state.favoriteRevealed && contestants.find(c => c.id === state.favoritoId);
  useMusicCue(favorite ? "victory" : null, favorite?.id);
  return (
    <section aria-label="Los favoritos de la audiencia" aria-live="polite" className="overflow-hidden rounded-xl border bg-white p-2 sm:p-5 text-center">
      <p className="mb-5 font-medium">La Audiencia ha decidido que los 3 concursantes más votados esta semana para ser el Favorito son…</p>
      <div className="grid grid-cols-3 gap-3">
        {order.map((id, index) => {
          const person = contestants.find(c => c.id === id);
          return <div key={index} className="flex min-h-32 items-center justify-center rounded-xl bg-gray-50 p-2">
            {index < count ? (
              <Motion.div key={id} initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.35 }} className="flex flex-col items-center gap-2">
                <img src={person?.photo || "/ot_photos/sinfoto.gif"} alt={person?.name || ""} className="h-[62px] w-[62px] rounded-xl object-cover sm:h-[62px] sm:w-[62px]" />
                <p className="text-sm font-semibold">{person?.name}</p>
              </Motion.div>
            ) : <span className="text-3xl text-gray-400" aria-label="Pendiente de revelar">?</span>}
          </div>;
        })}
      </div>
      <div className="mt-5 flex min-h-40 items-center justify-center">
        {favorite ? (
          <Motion.div key={favorite.id} initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.45 }} className="flex w-full flex-col items-center gap-2 rounded-xl bg-blue-50 p-4">
            <p className="font-semibold text-blue-700">🌟 El favorito de la audiencia es…</p>
            <img src={favorite.photo || "/ot_photos/sinfoto.gif"} alt={favorite.name} className="h-[62px] w-[62px] rounded-xl object-cover ring-4 ring-blue-400" />
            <p className="text-xl font-bold">{favorite.name}</p>
            <p className="text-sm">Se libra de la nominación del jurado.</p>
            {performances[favorite.id]?.judge && <StaffBadge name={performances[favorite.id].judge} />}
            <p>{favoriteComment(performances[favorite.id])}</p>
          </Motion.div>
        ) : <p className="text-sm text-gray-500">{count < 3 ? "Los nombres aparecen en orden aleatorio, sin indicar su posición." : "Entre estos tres está el favorito de la semana…"}</p>}
      </div>
      {favorite && <Button onClick={onContinue}>Continuar con las valoraciones</Button>}
    </section>
  );
}
