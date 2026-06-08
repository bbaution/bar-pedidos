import axios from "axios";

const api = axios.create({
  baseURL: "https://relenting-embassy-predict.ngrok-free.dev/api",
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

export default api;