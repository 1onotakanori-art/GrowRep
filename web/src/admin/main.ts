// 管理画面（/admin）の起動処理。
// 画面の処理（public/admin/app.js）は旧 GitHub Pages 版から移した compat SDK 前提の
// classic script なので、ここで compat SDK を初期化して auth / db / firebase を
// グローバルに置いてから読み込む（旧版の firebase-config.js と同じ役割）。
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { firebaseConfig } from '../lib/firebase-config';

firebase.initializeApp(firebaseConfig);
Object.assign(window, {
  firebase,
  auth: firebase.auth(),
  db: firebase.firestore(),
});

const script = document.createElement('script');
script.src = '/admin/app.js';
document.body.appendChild(script);
