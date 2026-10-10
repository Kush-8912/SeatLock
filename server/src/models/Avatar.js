import mongoose from 'mongoose';

// A profile photo, kept in MongoDB rather than on disk so it survives
// redeploys on hosts whose filesystem is wiped (Render). The browser crops and
// shrinks photos before upload, so each is a few tens of kilobytes.
const avatarSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  },
  { timestamps: true, versionKey: false },
);

export const Avatar = mongoose.model('Avatar', avatarSchema);
