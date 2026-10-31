package com.tung.chitieu.textrecognition

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import com.google.android.gms.tasks.Task
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/**
 * On-device text recognition with ML Kit. Returns every recognised line with
 * its bounding box in image pixels, which the JS receipt parser uses to pair
 * labels with their values.
 */
class TextRecognitionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ChiTieuTextRecognition")

    AsyncFunction("recognizeLines") Coroutine { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val bitmap = try {
        loadBitmap(context, Uri.parse(uri))
      } catch (e: Exception) {
        throw CodedException("ERR_IMAGE", "Could not open image $uri (${e.javaClass.simpleName}: ${e.message})", e)
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val image = InputImage.fromBitmap(bitmap, rotationOf(context, Uri.parse(uri)))
        val text = recognizer.process(image).await()
        text.textBlocks.flatMap { block ->
          block.lines.map { line ->
            val box = line.boundingBox
            mapOf(
              "text" to line.text,
              "left" to (box?.left ?: 0),
              "top" to (box?.top ?: 0),
              "right" to (box?.right ?: 0),
              "bottom" to (box?.bottom ?: 0)
            )
          }
        }
      } finally {
        recognizer.close()
        bitmap.recycle()
      }
    }
  }
}

/**
 * Decodes the image ourselves rather than with InputImage.fromFilePath, which
 * failed on file:// URIs from the image picker in release builds.
 */
private fun loadBitmap(context: Context, uri: Uri): Bitmap {
  val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
  val bitmap = if (uri.scheme == null || uri.scheme == "file") {
    val path = uri.path ?: throw IllegalArgumentException("no file path")
    if (!java.io.File(path).exists()) throw java.io.FileNotFoundException(path)
    BitmapFactory.decodeFile(path, options)
  } else {
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
  }
  return bitmap ?: throw java.io.IOException("image could not be decoded")
}

/** Photos can be stored sideways with an EXIF rotation; screenshots have none. */
private fun rotationOf(context: Context, uri: Uri): Int = try {
  val exif = if (uri.scheme == null || uri.scheme == "file") {
    ExifInterface(uri.path!!)
  } else {
    context.contentResolver.openInputStream(uri)!!.use { ExifInterface(it) }
  }
  when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
    ExifInterface.ORIENTATION_ROTATE_90 -> 90
    ExifInterface.ORIENTATION_ROTATE_180 -> 180
    ExifInterface.ORIENTATION_ROTATE_270 -> 270
    else -> 0
  }
} catch (e: Exception) {
  0
}

private suspend fun <T> Task<T>.await(): T = suspendCoroutine { continuation ->
  addOnSuccessListener { continuation.resume(it) }
  addOnFailureListener { continuation.resumeWithException(it) }
}
