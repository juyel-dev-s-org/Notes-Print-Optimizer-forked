(module
  (memory (export "memory") 2048 16384)

  ;; helper to set mask pixel to 1 at (baseY, baseX) + (kx, ky)
  ;; uses $w, $data from caller
  (func $set1
    (param $y i32) (param $x i32) (param $kx i32) (param $ky i32) (param $w i32) (param $data i32)
    local.get $data
    local.get $y local.get $ky i32.add
    local.get $w i32.mul
    local.get $x local.get $kx i32.add
    i32.add i32.add
    i32.const 1 i32.store8
  )

  ;; applyMaskDilation — binary mask Uint8Array, in-place dilation
  ;; $data byte offset of mask, $copy byte offset of scratch (≥ $data + w*h)
  ;; $w $h dimensions, $ks kernel size (odd, typically 3 or 5)
  (func (export "applyMaskDilation")
    (param $data i32) (param $copy i32) (param $w i32) (param $h i32) (param $ks i32)
    (local $hks i32) (local $len i32) (local $i i32)
    (local $y i32) (local $x i32) (local $ro i32) (local $idx i32) (local $v i32)
    (local $ky i32) (local $kx i32)
    (local $yend i32) (local $xend i32)

    local.get $ks i32.const 2 i32.div_u local.set $hks
    local.get $w local.get $h i32.mul local.set $len

    (block $copy_end
      (loop $copy_loop
        local.get $copy local.get $i i32.add
        local.get $data local.get $i i32.add i32.load8_u i32.store8
        local.get $i i32.const 1 i32.add local.tee $i local.get $len i32.lt_u br_if $copy_loop
      )
    )

    local.get $h local.get $hks i32.sub local.set $yend
    local.get $w local.get $hks i32.sub local.set $xend

    local.get $hks local.set $y
    (block $y_break
      (loop $y_loop
        local.get $y local.get $w i32.mul local.set $ro
        local.get $hks local.set $x
        (block $x_break
          (loop $x_loop
            local.get $ro local.get $x i32.add local.tee $idx
            local.get $copy i32.add i32.load8_u local.set $v
            (if (i32.eq (local.get $v) (i32.const 1))
              (then
                ;; dispatch on kernel size
                (if (i32.eq (local.get $ks) (i32.const 3))
                  (then
                    ;; cross pattern: 5 neighbors
                    local.get $y local.get $x i32.const 0 i32.const -1 local.get $w local.get $data call $set1
                    local.get $y local.get $x i32.const -1 i32.const 0 local.get $w local.get $data call $set1
                    local.get $y local.get $x i32.const 0 i32.const 0 local.get $w local.get $data call $set1
                    local.get $y local.get $x i32.const 1 i32.const 0 local.get $w local.get $data call $set1
                    local.get $y local.get $x i32.const 0 i32.const 1 local.get $w local.get $data call $set1
                  )
                  (else
                    (if (i32.eq (local.get $ks) (i32.const 5))
                      (then
                        ;; step 1: kx=-2..2, ky=0
                        local.get $y local.get $x i32.const -2 i32.const 0 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const -1 i32.const 0 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const 0 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 1 i32.const 0 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 2 i32.const 0 local.get $w local.get $data call $set1
                        ;; step 2: ky=-2,-1,1,2, kx=-1,0,1
                        local.get $y local.get $x i32.const -1 i32.const -2 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const -2 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 1 i32.const -2 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const -1 i32.const -1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const -1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 1 i32.const -1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const -1 i32.const 1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const 1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 1 i32.const 1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const -1 i32.const 2 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const 2 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 1 i32.const 2 local.get $w local.get $data call $set1
                        ;; step 3: far neighbors
                        local.get $y local.get $x i32.const -2 i32.const -1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 2 i32.const -1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const -2 i32.const 0 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 2 i32.const 0 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const -2 i32.const 1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 2 i32.const 1 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const -2 local.get $w local.get $data call $set1
                        local.get $y local.get $x i32.const 0 i32.const 2 local.get $w local.get $data call $set1
                      )
                      (else
                        ;; general case: full square
                        i32.const 0 local.get $hks i32.sub local.set $ky
                        (block $ky_break
                          (loop $ky_loop
                            i32.const 0 local.get $hks i32.sub local.set $kx
                            (block $kx_break
                              (loop $kx_loop
                                local.get $y local.get $ky i32.add
                                local.get $w i32.mul
                                local.get $x local.get $kx i32.add i32.add
                                local.get $data i32.add
                                i32.const 1 i32.store8
                                local.get $kx i32.const 1 i32.add
                                local.tee $kx local.get $hks i32.le_s br_if $kx_loop
                              )
                            )
                            local.get $ky i32.const 1 i32.add
                            local.tee $ky local.get $hks i32.le_s br_if $ky_loop
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
            local.get $x i32.const 1 i32.add
            local.tee $x local.get $xend i32.lt_s br_if $x_loop
          )
        )
        local.get $y i32.const 1 i32.add
        local.tee $y local.get $yend i32.lt_s br_if $y_loop
      )
    )
  )

  ;; applyUnsharpMask — RGBA Uint8ClampedArray, in-place unsharp masking
  ;; $data byte offset, $copy scratch offset (≥ $data + w*h*4)
  ;; $w $h dimensions, $amt sharpening amount (typically 0.5–2.0)
  (func (export "applyUnsharpMask")
    (param $data i32) (param $copy i32) (param $w i32) (param $h i32) (param $amt f64)
    (local $stride i32) (local $len i32) (local $i i32)
    (local $y i32) (local $x i32) (local $c i32) (local $idx i32) (local $ctr f64)
    (local $lap f64) (local $en i32)

    local.get $w i32.const 4 i32.mul local.set $stride
    local.get $w local.get $h i32.mul i32.const 4 i32.mul local.set $len

    ;; copy data -> copy
    (block $copy_end
      (loop $copy_loop
        local.get $copy local.get $i i32.add
        local.get $data local.get $i i32.add i32.load8_u i32.store8
        local.get $i i32.const 1 i32.add local.tee $i local.get $len i32.lt_u br_if $copy_loop
      )
    )

    i32.const 1 local.set $y
    (block $y_break
      (loop $y_loop
        i32.const 1 local.set $x
        (block $x_break
          (loop $x_loop
            local.get $y local.get $stride i32.mul
            local.get $x i32.const 4 i32.mul i32.add
            local.set $idx
            i32.const 0 local.set $c
            (block $c_break
              (loop $c_loop
                local.get $copy local.get $idx local.get $c i32.add i32.add i32.load8_u
                f64.convert_i32_u local.set $ctr

                f64.const 4 local.get $ctr f64.mul

                local.get $copy local.get $idx local.get $stride i32.sub local.get $c i32.add i32.add i32.load8_u
                f64.convert_i32_u f64.sub

                local.get $copy local.get $idx local.get $stride i32.add local.get $c i32.add i32.add i32.load8_u
                f64.convert_i32_u f64.sub

                local.get $copy local.get $idx i32.const 4 i32.sub local.get $c i32.add i32.add i32.load8_u
                f64.convert_i32_u f64.sub

                local.get $copy local.get $idx i32.const 4 i32.add local.get $c i32.add i32.add i32.load8_u
                f64.convert_i32_u f64.sub

                local.set $lap

                local.get $ctr local.get $amt local.get $lap f64.mul f64.add
                f64.const 0 f64.max f64.const 255 f64.min
                i32.trunc_f64_u
                local.set $en

                local.get $data local.get $idx local.get $c i32.add i32.add
                local.get $en
                i32.store8

                local.get $c i32.const 1 i32.add
                local.tee $c i32.const 3 i32.lt_s br_if $c_loop
              )
            )
            local.get $x i32.const 1 i32.add
            local.tee $x local.get $w i32.const 1 i32.sub i32.lt_s br_if $x_loop
          )
        )
        local.get $y i32.const 1 i32.add
        local.tee $y local.get $h i32.const 1 i32.sub i32.lt_s br_if $y_loop
      )
    )
  )

)
