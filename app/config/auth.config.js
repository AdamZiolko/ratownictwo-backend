require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || "q4X{k1W:e;(PpqC:#:GQ_y6U(taau_=D8$]w2bf2FEgX]$6W-z7tkc*y;e2W:0W!Hm=3gd%VhuBXBYvAJ1}QigfV#q8(Ctmz0S&#f!7,a/r!,/$w,#BVu}Mh",
  jwtExpiration: parseInt(process.env.JWT_EXPIRATION) || 60,           
  jwtRefreshExpiration: parseInt(process.env.JWT_REFRESH_EXPIRATION) || 3600,   
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "8(Ctmz0S&#f!7,a/r!,/$w,#BVu}Mhnx(L;RvQ7!cT&#JXE@h@5KpLd;dH/;cm?}(:Mh}b}yEJE9]MQ9qp8=@NHLynUyD{a3u,aF-B},89dGmXz5YqCy5Mr2" 
};