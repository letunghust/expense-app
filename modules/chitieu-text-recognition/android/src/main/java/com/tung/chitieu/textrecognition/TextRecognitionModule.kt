package com.tung.chitieu.textrecognition

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
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        throw CodedException("ERR_IMAGE", "Could not open image $uri", e)
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
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
      }
    }
  }
}

private suspend fun <T> Task<T>.await(): T = suspendCoroutine { continuation ->
  addOnSuccessListener { continuation.resume(it) }
  addOnFailureListener { continuation.resumeWithException(it) }
}
