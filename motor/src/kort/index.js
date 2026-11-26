// Kildekort: ét pr. tema. Thomas' egne modeller og de bedstes praksis, oversat til hans ord.
// Teksten er uddrag og omskrivninger af hans papers på friisnaes.com; kilderne står nederst i hvert kort.
import { ROLLESPIL } from './rollespil.js';
import { DET_JEG_UNDGAAR } from './det-jeg-undgaar.js';
import { STYRKEN_UNDER_PRES } from './styrken-under-pres.js';
import { INTERESSENTKORTET } from './interessentkortet.js';
import { DEN_SAMTALE_JEG_SKYLDER } from './den-samtale-jeg-skylder.js';
import { UGENS_REVIEW } from './ugens-review.js';
import { MOENSTERSPEJLET } from './moensterspejlet.js';

export const KORT = {
  [ROLLESPIL.id]: ROLLESPIL,
  [DET_JEG_UNDGAAR.id]: DET_JEG_UNDGAAR,
  [STYRKEN_UNDER_PRES.id]: STYRKEN_UNDER_PRES,
  [INTERESSENTKORTET.id]: INTERESSENTKORTET,
  [DEN_SAMTALE_JEG_SKYLDER.id]: DEN_SAMTALE_JEG_SKYLDER,
  [UGENS_REVIEW.id]: UGENS_REVIEW,
  [MOENSTERSPEJLET.id]: MOENSTERSPEJLET,
};
