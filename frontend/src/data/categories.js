import { FaHands, FaHeart, FaSun, FaUsers } from "react-icons/fa6";

export const categories = [
  {
    id: "wedding",
    label: "Wedding",
    icon: FaHeart,
    gradient: "from-emerald-400 via-teal-400 to-cyan-400",
    accent: "text-emerald-200",
  },
  {
    id: "cousins",
    label: "Cousins",
    icon: FaUsers,
    gradient: "from-rose-400 via-orange-400 to-amber-300",
    accent: "text-orange-200",
  },
  {
    id: "haldi",
    label: "Haldi",
    icon: FaSun,
    gradient: "from-fuchsia-400 via-pink-400 to-rose-300",
    accent: "text-pink-200",
  },
  {
    id: "mehndi",
    label: "Mehndi",
    icon: FaHands,
    gradient: "from-sky-400 via-indigo-400 to-violet-400",
    accent: "text-sky-200",
  },
];
