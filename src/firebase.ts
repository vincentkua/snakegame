import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyALEO5s3UEHBm2MPMSa-eiyZ0Vg9bayI-4",
  authDomain: "vk-snakegame.firebaseapp.com",
  projectId: "vk-snakegame",
  storageBucket: "vk-snakegame.firebasestorage.app",
  messagingSenderId: "390793231398",
  appId: "1:390793231398:web:9f084138696d7e78c23ae7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
