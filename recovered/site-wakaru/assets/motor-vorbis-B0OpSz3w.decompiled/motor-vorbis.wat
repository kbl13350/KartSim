(module
  (type (;0;) (func (param i32 i64 i32) (result i32)))
  (type (;1;) (func (param i32) (result i32)))
  (type (;2;) (func (param i32 i32 i32 i32) (result i32)))
  (type (;3;) (func (param i32 i32 i32) (result i32)))
  (type (;4;) (func (param i32)))
  (type (;5;) (func (param i32 i32) (result i32)))
  (type (;6;) (func (param i32 i32 i32 i32 i32) (result i32)))
  (type (;7;) (func))
  (type (;8;) (func (param i32 i32)))
  (type (;9;) (func (param i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;10;) (func (param i32 i32) (result i64)))
  (type (;11;) (func (param i32 i64 i32 i32 i32 i32) (result i64)))
  (type (;12;) (func (param i32 i64 i64 i64 i64 i32 i32 i32 i32) (result i32)))
  (type (;13;) (func (param i32 i32 i64) (result i64)))
  (type (;14;) (func (param i32 i32 i32)))
  (type (;15;) (func (param i32 i32 i32 i32 i32 i32 i32)))
  (type (;16;) (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
  (type (;17;) (func (param i32 i32 i32 i32 i32)))
  (import "wasi_snapshot_preview1" "fd_prestat_get" (func $wasi_fd_prestat_get (type 5)))
  (import "wasi_snapshot_preview1" "fd_prestat_dir_name" (func $wasi_fd_prestat_dir_name (type 3)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $wasi_proc_exit (type 4)))
  (import "wasi_snapshot_preview1" "random_get" (func $wasi_random_get (type 5)))
  (func $__wasm_call_ctors (type 7)
    call $__wasilibc_populate_preopens
    call $__init_random_seed)
  (func $_initialize (type 7)
    block  ;; label = @1
      i32.const 0
      i32.load offset=16799488
      i32.eqz
      br_if 0 (;@1;)
      unreachable
      unreachable
    end
    i32.const 0
    i32.const 1
    i32.store offset=16799488
    call $__wasm_call_ctors)
  (func $decode (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i64 i64 i64 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 1072
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store offset=680
    local.get 2
    local.get 1
    i32.store offset=676
    local.get 2
    local.get 0
    i32.store offset=672
    local.get 2
    i32.const 672
    i32.add
    i64.const 0
    i32.const 1
    call $mem_seek
    local.set 1
    local.get 2
    i32.const 0
    i32.store offset=712
    local.get 2
    i32.const 0
    i32.store offset=696
    local.get 2
    i32.const 8
    i32.add
    i32.const 0
    i32.const 648
    call $memset
    drop
    local.get 2
    i32.const 664
    i32.add
    i32.const 0
    i64.load offset=16777224
    i64.store
    local.get 2
    i32.const 660
    i32.add
    i32.const 1
    i32.store
    local.get 2
    i32.const 8
    i32.add
    i32.const 32
    i32.add
    i64.const 0
    i64.store
    local.get 2
    i32.const 48
    i32.add
    i64.const 0
    i64.store
    local.get 2
    i32.const 56
    i32.add
    i32.const 0
    i32.store
    local.get 2
    i32.const 2
    i32.store offset=656
    local.get 2
    i64.const 0
    i64.store offset=32
    local.get 2
    local.get 2
    i32.const 672
    i32.add
    i32.store offset=8
    block  ;; label = @1
      local.get 1
      i32.const -1
      i32.eq
      br_if 0 (;@1;)
      local.get 2
      i32.const 1
      i32.store offset=12
    end
    local.get 2
    i32.const 1
    i32.store offset=60
    local.get 2
    i32.const 1
    i32.const 32
    call $calloc
    i32.store offset=80
    local.get 2
    i32.const 1
    i32.const 16
    call $calloc
    i32.store offset=84
    local.get 2
    i32.const 128
    i32.add
    local.tee 3
    i32.const -1
    call $ogg_stream_init
    block  ;; label = @1
      block  ;; label = @2
        local.get 2
        i32.const 8
        i32.add
        local.get 2
        i32.load offset=80
        local.get 2
        i32.load offset=84
        local.get 2
        i32.const 712
        i32.add
        local.get 2
        i32.const 696
        i32.add
        i32.const 0
        call $_fetch_headers
        local.tee 0
        i32.const -1
        i32.gt_s
        br_if 0 (;@2;)
        local.get 2
        i32.const 0
        i32.store offset=8
        local.get 2
        i32.const 8
        i32.add
        call $ov_clear
        local.get 2
        i32.load offset=712
        local.set 1
        br 1 (;@1;)
      end
      local.get 2
      i32.load offset=696
      local.tee 4
      i32.const 2
      i32.add
      i32.const 4
      call $calloc
      local.tee 1
      i32.const 4
      i32.add
      local.get 4
      i32.store
      local.get 1
      local.get 2
      i32.const 464
      i32.add
      i32.load
      local.tee 5
      i32.store
      local.get 2
      local.get 1
      i32.store offset=72
      local.get 2
      local.get 5
      i32.store offset=100
      local.get 1
      i32.const 8
      i32.add
      local.get 2
      i32.load offset=712
      local.tee 1
      local.get 4
      i32.const 2
      i32.shl
      call $memcpy
      drop
      local.get 2
      i32.const 1
      i32.const 8
      call $calloc
      i32.store offset=64
      i32.const 1
      i32.const 8
      call $calloc
      local.tee 4
      local.get 2
      i64.load offset=16
      i64.store
      local.get 2
      local.get 4
      i32.store offset=68
      local.get 2
      i32.const 1
      i32.store offset=96
    end
    block  ;; label = @1
      local.get 1
      i32.eqz
      br_if 0 (;@1;)
      local.get 1
      call $free
    end
    i32.const 0
    local.set 1
    block  ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 2
      i32.load offset=96
      i32.const 1
      i32.ne
      br_if 0 (;@1;)
      local.get 2
      i32.const 2
      i32.store offset=96
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              local.get 2
              i32.load offset=12
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              i32.load offset=68
              i64.load
              local.set 6
              local.get 2
              i64.const -1
              i64.store offset=688
              local.get 2
              local.get 2
              i32.const 464
              i32.add
              i32.load
              local.tee 0
              i32.store offset=684
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.load offset=80
              call $_initial_pcmoffset
              local.set 7
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 2
                    i32.const 660
                    i32.add
                    i32.load
                    local.tee 1
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 2
                    i32.const 668
                    i32.add
                    i32.load
                    br_if 1 (;@7;)
                  end
                  local.get 2
                  i32.const 24
                  i32.add
                  i64.const -1
                  i64.store
                  local.get 2
                  i64.const -1
                  i64.store offset=16
                  br 1 (;@6;)
                end
                local.get 2
                i32.load offset=8
                i64.const 0
                i32.const 2
                local.get 1
                call_indirect (type 0)
                drop
                local.get 2
                local.get 2
                i32.load offset=8
                local.get 2
                i32.load offset=668
                call_indirect (type 1)
                local.tee 1
                i64.extend_i32_s
                local.tee 8
                i64.store offset=16
                local.get 2
                local.get 8
                i64.store offset=24
                local.get 1
                i32.const -1
                i32.eq
                br_if 0 (;@6;)
                local.get 2
                i32.const 8
                i32.add
                local.get 8
                local.get 2
                i32.load offset=72
                local.tee 1
                i32.const 8
                i32.add
                local.get 1
                i32.const 4
                i32.add
                i32.load
                local.get 2
                i32.const 684
                i32.add
                local.get 2
                i32.const 688
                i32.add
                call $_get_prev_page_serial
                local.tee 8
                i64.const -1
                i64.le_s
                br_if 0 (;@6;)
                local.get 2
                i32.const 8
                i32.add
                i64.const 0
                local.get 6
                local.get 8
                local.get 2
                i64.load offset=688
                local.get 2
                i32.load offset=684
                local.get 2
                i32.load offset=72
                local.tee 1
                i32.const 8
                i32.add
                local.get 1
                i32.const 4
                i32.add
                i32.load
                i32.const 0
                call $_bisect_forward_serialno
                i32.const 0
                i32.lt_s
                br_if 0 (;@6;)
                local.get 2
                i32.load offset=64
                i64.const 0
                i64.store
                local.get 2
                i32.load offset=68
                local.get 6
                i64.store
                local.get 2
                i32.load offset=72
                local.get 0
                i32.store
                local.get 2
                i32.load offset=76
                local.tee 1
                i32.const 8
                i32.add
                local.tee 0
                local.get 0
                i64.load
                local.get 7
                i64.sub
                local.tee 8
                i64.const 0
                local.get 8
                i64.const 0
                i64.gt_s
                select
                i64.store
                local.get 1
                local.get 7
                i64.store
                local.get 2
                i32.load offset=96
                local.tee 1
                i32.const 2
                i32.lt_s
                br_if 0 (;@6;)
                local.get 2
                i32.load offset=12
                i32.eqz
                br_if 0 (;@6;)
                local.get 6
                i64.const 0
                i64.lt_s
                br_if 0 (;@6;)
                local.get 2
                i64.load offset=24
                local.get 6
                i64.lt_s
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 1
                  i32.const 2
                  i32.eq
                  br_if 0 (;@7;)
                  block  ;; label = @8
                    local.get 2
                    i32.load offset=64
                    local.get 2
                    i32.load offset=104
                    i32.const 3
                    i32.shl
                    i32.add
                    local.tee 1
                    i64.load
                    local.get 6
                    i64.gt_s
                    br_if 0 (;@8;)
                    local.get 1
                    i32.const 8
                    i32.add
                    i64.load
                    local.get 6
                    i64.gt_s
                    br_if 1 (;@7;)
                  end
                  local.get 2
                  i32.const 488
                  i32.add
                  call $vorbis_dsp_clear
                  local.get 2
                  i32.const 568
                  i32.add
                  call $vorbis_block_clear
                  local.get 2
                  i32.const 2
                  i32.store offset=96
                end
                local.get 2
                i64.const -1
                i64.store offset=88
                block  ;; label = @7
                  local.get 2
                  i32.load offset=128
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 2
                  i32.const 472
                  i32.add
                  i64.const 0
                  i64.store
                  local.get 2
                  i32.const 468
                  i32.add
                  i32.const -1
                  i32.store
                  local.get 2
                  i32.const 460
                  i32.add
                  i32.const 0
                  i32.store
                  local.get 2
                  i32.const 452
                  i32.add
                  i64.const 0
                  i64.store align=4
                  local.get 2
                  i32.const 164
                  i32.add
                  i32.const 0
                  i32.store
                  local.get 2
                  i32.const 156
                  i32.add
                  i64.const 0
                  i64.store align=4
                  local.get 2
                  i32.const 136
                  i32.add
                  i64.const 0
                  i64.store
                  local.get 2
                  i32.const 480
                  i32.add
                  i64.const 0
                  i64.store
                  local.get 2
                  local.get 2
                  i32.load offset=100
                  i32.store offset=464
                end
                block  ;; label = @7
                  local.get 2
                  i32.const 560
                  i32.add
                  i32.load
                  local.tee 1
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 2
                  i32.const 492
                  i32.add
                  i32.load
                  local.tee 0
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 0
                  i32.load offset=28
                  local.tee 0
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 0
                  i32.const 4
                  i32.add
                  i32.load
                  local.set 0
                  local.get 2
                  i32.const 544
                  i32.add
                  i64.const -1
                  i64.store
                  local.get 2
                  i32.const 552
                  i32.add
                  i64.const -1
                  i64.store
                  local.get 2
                  i32.const 512
                  i32.add
                  i32.const -1
                  i32.store
                  local.get 2
                  i32.const 508
                  i32.add
                  local.get 0
                  i32.const 2
                  i32.div_s
                  local.tee 0
                  i32.store
                  local.get 2
                  i32.const 536
                  i32.add
                  local.get 0
                  i32.store
                  local.get 1
                  i64.const -1
                  i64.store offset=16
                end
                local.get 2
                i32.const 488
                i32.add
                local.set 9
                block  ;; label = @7
                  local.get 2
                  i32.load offset=8
                  local.tee 1
                  i32.eqz
                  br_if 0 (;@7;)
                  block  ;; label = @8
                    local.get 2
                    i64.load offset=16
                    local.get 6
                    i64.eq
                    br_if 0 (;@8;)
                    local.get 2
                    i32.load offset=660
                    local.tee 0
                    i32.eqz
                    br_if 1 (;@7;)
                    local.get 1
                    local.get 6
                    i32.const 0
                    local.get 0
                    call_indirect (type 0)
                    i32.const -1
                    i32.eq
                    br_if 1 (;@7;)
                    local.get 2
                    local.get 6
                    i64.store offset=16
                    local.get 2
                    i32.const 36
                    i32.add
                    i32.load
                    i32.const 0
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 2
                    i32.const 56
                    i32.add
                    i32.const 0
                    i32.store
                    local.get 2
                    i32.const 48
                    i32.add
                    i64.const 0
                    i64.store
                    local.get 2
                    i32.const 40
                    i32.add
                    i64.const 0
                    i64.store
                  end
                  local.get 2
                  i32.const 712
                  i32.add
                  local.get 2
                  i32.load offset=100
                  call $ogg_stream_init
                  block  ;; label = @8
                    local.get 2
                    i32.load offset=712
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 2
                    i32.const 1064
                    i32.add
                    i64.const 0
                    i64.store
                    local.get 2
                    i64.const 0
                    i64.store offset=1056
                    local.get 2
                    i32.const -1
                    i32.store offset=1052
                    local.get 2
                    i32.const 0
                    i32.store offset=1044
                    local.get 2
                    i64.const 0
                    i64.store offset=1036 align=4
                    local.get 2
                    i32.const 0
                    i32.store offset=748
                    local.get 2
                    i64.const 0
                    i64.store offset=740 align=4
                    local.get 2
                    i64.const 0
                    i64.store offset=720
                  end
                  local.get 2
                  i32.const 472
                  i32.add
                  local.set 10
                  local.get 2
                  i32.const 164
                  i32.add
                  local.set 11
                  local.get 2
                  i32.const 748
                  i32.add
                  local.set 12
                  local.get 2
                  i32.const 568
                  i32.add
                  local.set 13
                  local.get 2
                  i32.const 1056
                  i32.add
                  local.tee 14
                  i32.const 8
                  i32.add
                  local.set 15
                  i32.const 0
                  local.set 16
                  i32.const 0
                  local.set 17
                  i32.const 0
                  local.set 18
                  loop  ;; label = @8
                    i32.const 0
                    local.set 19
                    block  ;; label = @9
                      loop  ;; label = @10
                        local.get 2
                        i32.load offset=96
                        local.set 20
                        loop  ;; label = @11
                          block  ;; label = @12
                            local.get 20
                            i32.const 3
                            i32.lt_s
                            br_if 0 (;@12;)
                            local.get 2
                            i32.load offset=712
                            local.tee 20
                            i32.eqz
                            br_if 0 (;@12;)
                            local.get 2
                            i32.load offset=744
                            local.get 2
                            i32.load offset=748
                            local.tee 0
                            i32.le_s
                            br_if 0 (;@12;)
                            block  ;; label = @13
                              block  ;; label = @14
                                local.get 2
                                i32.load offset=728
                                local.get 0
                                i32.const 2
                                i32.shl
                                i32.add
                                local.tee 5
                                i32.load
                                local.tee 1
                                i32.const 1024
                                i32.and
                                i32.eqz
                                br_if 0 (;@14;)
                                local.get 12
                                local.set 4
                                local.get 14
                                local.set 1
                                br 1 (;@13;)
                              end
                              block  ;; label = @14
                                local.get 1
                                i32.const 255
                                i32.and
                                local.tee 4
                                i32.const 255
                                i32.ne
                                br_if 0 (;@14;)
                                local.get 5
                                i32.const 4
                                i32.add
                                local.set 1
                                i32.const 255
                                local.set 4
                                loop  ;; label = @15
                                  local.get 0
                                  i32.const 1
                                  i32.add
                                  local.set 0
                                  local.get 1
                                  i32.load8_u
                                  local.tee 5
                                  local.get 4
                                  i32.add
                                  local.set 4
                                  local.get 1
                                  i32.const 4
                                  i32.add
                                  local.set 1
                                  local.get 5
                                  i32.const 255
                                  i32.eq
                                  br_if 0 (;@15;)
                                end
                              end
                              local.get 2
                              local.get 0
                              i32.const 1
                              i32.add
                              i32.store offset=748
                              local.get 2
                              local.get 2
                              i32.load offset=724
                              local.tee 1
                              local.get 4
                              i32.add
                              i32.store offset=724
                              local.get 2
                              i32.load offset=732
                              local.get 0
                              i32.const 3
                              i32.shl
                              i32.add
                              i64.load
                              local.set 6
                              local.get 2
                              local.get 2
                              i64.load offset=1056
                              i64.const 1
                              i64.add
                              i64.store offset=1056
                              block  ;; label = @14
                                local.get 2
                                i32.load offset=80
                                local.get 2
                                i32.load offset=104
                                i32.const 5
                                i32.shl
                                i32.add
                                i32.const 28
                                i32.add
                                i32.load
                                local.tee 0
                                i32.eqz
                                br_if 0 (;@14;)
                                block  ;; label = @15
                                  block  ;; label = @16
                                    local.get 0
                                    local.get 20
                                    local.get 1
                                    i32.add
                                    local.get 4
                                    call $vorbis_packet_blocksize
                                    local.tee 1
                                    i32.const -1
                                    i32.gt_s
                                    br_if 0 (;@16;)
                                    i32.const 0
                                    local.set 19
                                    local.get 3
                                    i32.const 0
                                    call $ogg_stream_packetout
                                    drop
                                    br 1 (;@15;)
                                  end
                                  block  ;; label = @16
                                    block  ;; label = @17
                                      local.get 17
                                      i32.eqz
                                      br_if 0 (;@17;)
                                      local.get 18
                                      br_if 0 (;@17;)
                                      local.get 3
                                      i32.const 0
                                      call $ogg_stream_packetout
                                      drop
                                      br 1 (;@16;)
                                    end
                                    local.get 19
                                    i32.eqz
                                    br_if 0 (;@16;)
                                    local.get 1
                                    local.get 19
                                    i32.add
                                    i32.const 2
                                    i32.shr_s
                                    local.get 16
                                    i32.add
                                    local.set 16
                                  end
                                  local.get 1
                                  local.set 19
                                end
                                local.get 6
                                i64.const -1
                                i64.eq
                                br_if 4 (;@10;)
                                local.get 6
                                local.get 2
                                i32.load offset=76
                                local.tee 5
                                local.get 2
                                i32.load offset=104
                                local.tee 4
                                i32.const 4
                                i32.shl
                                i32.add
                                i64.load
                                i64.sub
                                local.tee 6
                                i64.const 0
                                local.get 6
                                i64.const 0
                                i64.gt_s
                                select
                                local.set 6
                                block  ;; label = @15
                                  local.get 4
                                  i32.const 1
                                  i32.lt_s
                                  br_if 0 (;@15;)
                                  local.get 4
                                  i32.const 3
                                  i32.and
                                  local.set 0
                                  block  ;; label = @16
                                    block  ;; label = @17
                                      local.get 4
                                      i32.const 4
                                      i32.ge_u
                                      br_if 0 (;@17;)
                                      i32.const 0
                                      local.set 3
                                      br 1 (;@16;)
                                    end
                                    local.get 5
                                    i32.const 56
                                    i32.add
                                    local.set 1
                                    local.get 4
                                    i32.const 2147483644
                                    i32.and
                                    local.tee 3
                                    local.set 4
                                    loop  ;; label = @17
                                      local.get 1
                                      i64.load
                                      local.get 1
                                      i32.const -16
                                      i32.add
                                      i64.load
                                      local.get 1
                                      i32.const -32
                                      i32.add
                                      i64.load
                                      local.get 1
                                      i32.const -48
                                      i32.add
                                      i64.load
                                      local.get 6
                                      i64.add
                                      i64.add
                                      i64.add
                                      i64.add
                                      local.set 6
                                      local.get 1
                                      i32.const 64
                                      i32.add
                                      local.set 1
                                      local.get 4
                                      i32.const -4
                                      i32.add
                                      local.tee 4
                                      br_if 0 (;@17;)
                                    end
                                  end
                                  local.get 0
                                  i32.eqz
                                  br_if 0 (;@15;)
                                  local.get 3
                                  i32.const 4
                                  i32.shl
                                  local.get 5
                                  i32.add
                                  i32.const 8
                                  i32.add
                                  local.set 1
                                  loop  ;; label = @16
                                    local.get 1
                                    i64.load
                                    local.get 6
                                    i64.add
                                    local.set 6
                                    local.get 1
                                    i32.const 16
                                    i32.add
                                    local.set 1
                                    local.get 0
                                    i32.const -1
                                    i32.add
                                    local.tee 0
                                    br_if 0 (;@16;)
                                  end
                                end
                                local.get 6
                                local.get 16
                                i64.extend_i32_s
                                i64.sub
                                local.tee 6
                                i64.const 0
                                local.get 6
                                i64.const 0
                                i64.gt_s
                                select
                                local.set 6
                                br 10 (;@4;)
                              end
                              local.get 2
                              i32.load offset=128
                              i32.eqz
                              br_if 1 (;@12;)
                              local.get 2
                              i32.load offset=160
                              local.get 2
                              i32.load offset=164
                              local.tee 0
                              i32.le_s
                              br_if 1 (;@12;)
                              block  ;; label = @14
                                local.get 2
                                i32.load offset=144
                                local.get 0
                                i32.const 2
                                i32.shl
                                i32.add
                                local.tee 5
                                i32.load
                                local.tee 1
                                i32.const 1024
                                i32.and
                                br_if 0 (;@14;)
                                block  ;; label = @15
                                  local.get 1
                                  i32.const 255
                                  i32.and
                                  local.tee 4
                                  i32.const 255
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 5
                                  i32.const 4
                                  i32.add
                                  local.set 1
                                  i32.const 255
                                  local.set 4
                                  loop  ;; label = @16
                                    local.get 0
                                    i32.const 1
                                    i32.add
                                    local.set 0
                                    local.get 1
                                    i32.load8_u
                                    local.tee 5
                                    local.get 4
                                    i32.add
                                    local.set 4
                                    local.get 1
                                    i32.const 4
                                    i32.add
                                    local.set 1
                                    local.get 5
                                    i32.const 255
                                    i32.eq
                                    br_if 0 (;@16;)
                                  end
                                end
                                local.get 2
                                local.get 2
                                i32.load offset=140
                                local.get 4
                                i32.add
                                i32.store offset=140
                              end
                              local.get 11
                              local.set 4
                              local.get 10
                              local.set 1
                            end
                            local.get 4
                            local.get 0
                            i32.const 1
                            i32.add
                            i32.store
                            local.get 1
                            local.get 1
                            i64.load
                            i64.const 1
                            i64.add
                            i64.store
                          end
                          block  ;; label = @12
                            local.get 19
                            i32.eqz
                            br_if 0 (;@12;)
                            i64.const -1
                            local.set 6
                            br 8 (;@4;)
                          end
                          block  ;; label = @12
                            local.get 2
                            i32.const 8
                            i32.add
                            local.get 2
                            i32.const 696
                            i32.add
                            i64.const -1
                            call $_get_next_page
                            local.tee 6
                            i64.const -1
                            i64.gt_s
                            br_if 0 (;@12;)
                            local.get 2
                            i32.const 8
                            i32.add
                            i32.const -1
                            call $ov_pcm_total
                            local.set 6
                            br 8 (;@4;)
                          end
                          local.get 2
                          i32.load offset=696
                          local.set 1
                          block  ;; label = @12
                            local.get 2
                            i32.load offset=96
                            local.tee 20
                            i32.const 3
                            i32.lt_s
                            br_if 0 (;@12;)
                            local.get 2
                            i32.load offset=100
                            local.get 1
                            i32.const 14
                            i32.add
                            i32.load align=1
                            i32.eq
                            br_if 3 (;@9;)
                            local.get 1
                            i32.const 5
                            i32.add
                            i32.load8_u
                            i32.const 2
                            i32.and
                            i32.eqz
                            br_if 3 (;@9;)
                            local.get 9
                            call $vorbis_dsp_clear
                            local.get 13
                            call $vorbis_block_clear
                            local.get 2
                            i32.const 2
                            i32.store offset=96
                            block  ;; label = @13
                              local.get 2
                              i32.load offset=712
                              local.tee 1
                              i32.eqz
                              br_if 0 (;@13;)
                              local.get 1
                              call $free
                            end
                            block  ;; label = @13
                              local.get 2
                              i32.load offset=728
                              local.tee 1
                              i32.eqz
                              br_if 0 (;@13;)
                              local.get 1
                              call $free
                            end
                            block  ;; label = @13
                              local.get 2
                              i32.load offset=732
                              local.tee 1
                              i32.eqz
                              br_if 0 (;@13;)
                              local.get 1
                              call $free
                            end
                            local.get 2
                            i32.const 712
                            i32.add
                            i32.const 0
                            i32.const 360
                            call $memset
                            drop
                            local.get 2
                            i32.load offset=96
                            local.tee 20
                            i32.const 2
                            i32.gt_s
                            br_if 3 (;@9;)
                            local.get 2
                            i32.load offset=696
                            local.set 1
                          end
                          local.get 1
                          i32.const 14
                          i32.add
                          i32.load align=1
                          local.set 5
                          i32.const 0
                          local.set 19
                          i32.const 0
                          local.set 0
                          block  ;; label = @12
                            local.get 2
                            i32.load offset=60
                            local.tee 4
                            i32.const 1
                            i32.lt_s
                            br_if 0 (;@12;)
                            i32.const 0
                            local.set 0
                            local.get 2
                            i32.load offset=72
                            local.set 1
                            loop  ;; label = @13
                              local.get 1
                              i32.load
                              local.get 5
                              i32.eq
                              br_if 1 (;@12;)
                              local.get 1
                              i32.const 4
                              i32.add
                              local.set 1
                              local.get 4
                              local.get 0
                              i32.const 1
                              i32.add
                              local.tee 0
                              i32.ne
                              br_if 0 (;@13;)
                            end
                            local.get 4
                            local.set 0
                          end
                          local.get 0
                          local.get 4
                          i32.eq
                          br_if 0 (;@11;)
                        end
                      end
                      local.get 2
                      local.get 5
                      i32.store offset=100
                      local.get 2
                      local.get 0
                      i32.store offset=104
                      block  ;; label = @10
                        local.get 2
                        i32.load offset=128
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 10
                        i64.const 0
                        i64.store
                        local.get 10
                        i32.const 8
                        i32.add
                        i64.const 0
                        i64.store
                        local.get 2
                        i32.const -1
                        i32.store offset=468
                        local.get 2
                        i32.const 0
                        i32.store offset=460
                        local.get 2
                        i64.const 0
                        i64.store offset=452 align=4
                        local.get 2
                        i32.const 0
                        i32.store offset=164
                        local.get 2
                        i64.const 0
                        i64.store offset=156 align=4
                        local.get 2
                        i64.const 0
                        i64.store offset=136
                        local.get 2
                        local.get 5
                        i32.store offset=464
                      end
                      block  ;; label = @10
                        local.get 2
                        i32.load offset=712
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 14
                        i64.const 0
                        i64.store
                        local.get 15
                        i64.const 0
                        i64.store
                        local.get 2
                        i32.const -1
                        i32.store offset=1052
                        local.get 2
                        i32.const 0
                        i32.store offset=1044
                        local.get 2
                        i64.const 0
                        i64.store offset=1036 align=4
                        local.get 2
                        i32.const 0
                        i32.store offset=748
                        local.get 2
                        i64.const 0
                        i64.store offset=740 align=4
                        local.get 2
                        i64.const 0
                        i64.store offset=720
                        local.get 2
                        local.get 5
                        i32.store offset=1048
                      end
                      local.get 2
                      i32.const 3
                      i32.store offset=96
                      local.get 6
                      local.get 2
                      i32.load offset=68
                      local.get 0
                      i32.const 3
                      i32.shl
                      i32.add
                      i64.load
                      i64.le_s
                      local.set 18
                    end
                    local.get 3
                    local.get 2
                    i32.const 696
                    i32.add
                    call $ogg_stream_pagein
                    local.get 2
                    i32.const 712
                    i32.add
                    local.get 2
                    i32.const 696
                    i32.add
                    call $ogg_stream_pagein
                    local.get 2
                    i32.load offset=696
                    i32.const 5
                    i32.add
                    i32.load8_u
                    i32.const 4
                    i32.and
                    local.set 17
                    br 0 (;@8;)
                  end
                end
                local.get 2
                i64.const -1
                i64.store offset=88
                block  ;; label = @7
                  local.get 2
                  i32.load offset=712
                  local.tee 1
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 1
                  call $free
                end
                block  ;; label = @7
                  local.get 2
                  i32.load offset=728
                  local.tee 1
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 1
                  call $free
                end
                block  ;; label = @7
                  local.get 2
                  i32.load offset=732
                  local.tee 1
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 1
                  call $free
                end
                local.get 2
                i32.const 712
                i32.add
                i32.const 0
                i32.const 360
                call $memset
                drop
                local.get 9
                call $vorbis_dsp_clear
                local.get 2
                i32.const 568
                i32.add
                call $vorbis_block_clear
                local.get 2
                i32.const 2
                i32.store offset=96
              end
              i32.const 0
              local.set 1
              local.get 2
              i32.const 0
              i32.store offset=8
              local.get 2
              i32.const 8
              i32.add
              call $ov_clear
              br 4 (;@1;)
            end
            local.get 2
            i32.const 3
            i32.store offset=96
            i32.const 1
            local.set 3
            br 1 (;@3;)
          end
          local.get 2
          local.get 6
          i64.store offset=88
          block  ;; label = @4
            local.get 2
            i32.load offset=712
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 2
            i32.load offset=728
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 2
            i32.load offset=732
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          local.get 2
          i32.const 120
          i32.add
          i64.const 0
          i64.store
          local.get 2
          i64.const 0
          i64.store offset=112
          local.get 2
          i32.load offset=12
          local.tee 1
          i32.eqz
          local.set 3
          local.get 1
          i32.eqz
          br_if 0 (;@3;)
          i32.const 0
          local.set 1
          local.get 2
          i32.load offset=60
          i32.const 0
          i32.gt_s
          br_if 0 (;@3;)
          local.get 2
          i32.const 8
          i32.add
          i32.const -1
          call $ov_pcm_total
          drop
          br 1 (;@2;)
        end
        local.get 2
        i32.const 8
        i32.add
        i32.const -1
        call $ov_pcm_total
        local.set 6
        block  ;; label = @3
          local.get 2
          i32.load offset=80
          local.tee 0
          i32.eqz
          br_if 0 (;@3;)
          local.get 0
          i32.load offset=4
          local.tee 20
          i32.const -3
          i32.add
          i32.const -2
          i32.lt_u
          br_if 0 (;@3;)
          local.get 0
          i32.load offset=8
          local.tee 19
          i32.const 8000
          i32.lt_s
          br_if 0 (;@3;)
          local.get 19
          i32.const 96000
          i32.gt_u
          br_if 0 (;@3;)
          local.get 6
          i64.const 1
          i64.lt_s
          br_if 0 (;@3;)
          local.get 2
          i32.load offset=60
          local.tee 1
          i32.const 1
          local.get 1
          i32.const 1
          i32.gt_s
          select
          local.set 9
          i32.const 1
          local.set 4
          block  ;; label = @4
            loop  ;; label = @5
              local.get 9
              local.get 4
              i32.eq
              br_if 1 (;@4;)
              i32.const 0
              local.set 1
              local.get 0
              i32.const 0
              local.get 4
              local.get 3
              select
              i32.const 5
              i32.shl
              i32.add
              local.tee 5
              i32.eqz
              br_if 3 (;@2;)
              local.get 5
              i32.const 4
              i32.add
              i32.load
              local.get 20
              i32.ne
              br_if 3 (;@2;)
              local.get 4
              i32.const 1
              i32.add
              local.set 4
              local.get 5
              i32.const 8
              i32.add
              i32.load
              local.get 19
              i32.eq
              br_if 0 (;@5;)
              br 3 (;@2;)
            end
          end
          local.get 6
          i32.const 2147483647
          local.get 20
          i32.const 1
          i32.shl
          i32.div_u
          i64.extend_i32_u
          i64.gt_s
          br_if 0 (;@3;)
          i32.const 1
          i32.const 16
          call $calloc
          local.tee 1
          i32.eqz
          br_if 0 (;@3;)
          local.get 1
          local.get 6
          i32.wrap_i64
          local.tee 5
          local.get 20
          i32.mul
          i32.const 1
          i32.shl
          local.tee 4
          call $malloc
          local.tee 3
          i32.store
          block  ;; label = @4
            local.get 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            local.get 20
            i32.store offset=8
            local.get 1
            local.get 5
            i32.store offset=4
            local.get 1
            local.get 0
            i32.load offset=8
            i32.store offset=12
            block  ;; label = @5
              block  ;; label = @6
                local.get 4
                i32.eqz
                br_if 0 (;@6;)
                i32.const 0
                local.set 0
                loop  ;; label = @7
                  local.get 2
                  i32.const 8
                  i32.add
                  local.get 3
                  local.get 0
                  i32.add
                  local.get 4
                  local.get 0
                  i32.sub
                  local.get 2
                  i32.const 712
                  i32.add
                  call $ov_read
                  local.tee 5
                  i32.const 0
                  i32.le_s
                  br_if 2 (;@5;)
                  local.get 5
                  local.get 0
                  i32.add
                  local.tee 0
                  local.get 4
                  i32.lt_u
                  br_if 0 (;@7;)
                end
              end
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 712
              i32.add
              i32.const 4
              local.get 2
              i32.const 696
              i32.add
              call $ov_read
              i32.eqz
              br_if 3 (;@2;)
            end
            local.get 3
            call $free
          end
          local.get 1
          call $free
        end
        i32.const 0
        local.set 1
      end
      local.get 2
      i32.const 8
      i32.add
      call $ov_clear
    end
    local.get 2
    i32.const 1072
    i32.add
    global.set $__stack_pointer
    local.get 1)
  (func $mem_seek (type 0) (param i32 i64 i32) (result i32)
    (local i32 i64)
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 2
            br_table 3 (;@1;) 0 (;@4;) 1 (;@3;) 2 (;@2;)
          end
          local.get 0
          i32.load offset=8
          local.set 2
          br 2 (;@1;)
        end
        local.get 0
        i32.load offset=4
        local.set 2
        br 1 (;@1;)
      end
      i32.const -1
      local.set 2
    end
    i32.const -1
    local.set 3
    block  ;; label = @1
      i64.const 0
      local.get 2
      i64.extend_i32_u
      local.tee 4
      i64.sub
      local.get 1
      i64.gt_s
      br_if 0 (;@1;)
      local.get 0
      i64.load32_u offset=4
      local.get 4
      i64.sub
      local.get 1
      i64.lt_s
      br_if 0 (;@1;)
      local.get 0
      local.get 2
      local.get 1
      i32.wrap_i64
      i32.add
      i32.store offset=8
      i32.const 0
      local.set 3
    end
    local.get 3)
  (func $memset (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i64)
    block  ;; label = @1
      local.get 2
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      i32.store8
      local.get 0
      local.get 2
      i32.add
      local.tee 3
      i32.const -1
      i32.add
      local.get 1
      i32.store8
      local.get 2
      i32.const 3
      i32.lt_u
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      i32.store8 offset=2
      local.get 0
      local.get 1
      i32.store8 offset=1
      local.get 3
      i32.const -3
      i32.add
      local.get 1
      i32.store8
      local.get 3
      i32.const -2
      i32.add
      local.get 1
      i32.store8
      local.get 2
      i32.const 7
      i32.lt_u
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      i32.store8 offset=3
      local.get 3
      i32.const -4
      i32.add
      local.get 1
      i32.store8
      local.get 2
      i32.const 9
      i32.lt_u
      br_if 0 (;@1;)
      local.get 0
      i32.const 0
      local.get 0
      i32.sub
      i32.const 3
      i32.and
      local.tee 4
      i32.add
      local.tee 3
      local.get 1
      i32.const 255
      i32.and
      i32.const 16843009
      i32.mul
      local.tee 1
      i32.store
      local.get 3
      local.get 2
      local.get 4
      i32.sub
      i32.const -4
      i32.and
      local.tee 4
      i32.add
      local.tee 2
      i32.const -4
      i32.add
      local.get 1
      i32.store
      local.get 4
      i32.const 9
      i32.lt_u
      br_if 0 (;@1;)
      local.get 3
      local.get 1
      i32.store offset=8
      local.get 3
      local.get 1
      i32.store offset=4
      local.get 2
      i32.const -8
      i32.add
      local.get 1
      i32.store
      local.get 2
      i32.const -12
      i32.add
      local.get 1
      i32.store
      local.get 4
      i32.const 25
      i32.lt_u
      br_if 0 (;@1;)
      local.get 3
      local.get 1
      i32.store offset=24
      local.get 3
      local.get 1
      i32.store offset=20
      local.get 3
      local.get 1
      i32.store offset=16
      local.get 3
      local.get 1
      i32.store offset=12
      local.get 2
      i32.const -16
      i32.add
      local.get 1
      i32.store
      local.get 2
      i32.const -20
      i32.add
      local.get 1
      i32.store
      local.get 2
      i32.const -24
      i32.add
      local.get 1
      i32.store
      local.get 2
      i32.const -28
      i32.add
      local.get 1
      i32.store
      local.get 4
      local.get 3
      i32.const 4
      i32.and
      i32.const 24
      i32.or
      local.tee 5
      i32.sub
      local.tee 2
      i32.const 32
      i32.lt_u
      br_if 0 (;@1;)
      local.get 1
      i64.extend_i32_u
      i64.const 4294967297
      i64.mul
      local.set 6
      local.get 3
      local.get 5
      i32.add
      local.set 1
      loop  ;; label = @2
        local.get 1
        local.get 6
        i64.store offset=24
        local.get 1
        local.get 6
        i64.store offset=16
        local.get 1
        local.get 6
        i64.store offset=8
        local.get 1
        local.get 6
        i64.store
        local.get 1
        i32.const 32
        i32.add
        local.set 1
        local.get 2
        i32.const -32
        i32.add
        local.tee 2
        i32.const 31
        i32.gt_u
        br_if 0 (;@2;)
      end
    end
    local.get 0)
  (func $mem_read (type 2) (param i32 i32 i32 i32) (result i32)
    (local i32)
    block  ;; label = @1
      local.get 1
      br_if 0 (;@1;)
      i32.const 0
      return
    end
    local.get 0
    local.get 3
    i32.load
    local.get 3
    i32.load offset=8
    local.tee 4
    i32.add
    local.get 3
    i32.load offset=4
    local.get 4
    i32.sub
    local.get 1
    i32.div_u
    local.tee 4
    local.get 2
    local.get 4
    local.get 2
    i32.lt_u
    select
    local.tee 2
    local.get 1
    i32.mul
    local.tee 1
    call $memcpy
    drop
    local.get 3
    local.get 3
    i32.load offset=8
    local.get 1
    i32.add
    i32.store offset=8
    local.get 2)
  (func $calloc (type 5) (param i32 i32) (result i32)
    block  ;; label = @1
      local.get 1
      local.get 0
      i32.mul
      local.tee 1
      call $emmalloc_memalign
      local.tee 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const 0
      local.get 1
      call $memset
      drop
    end
    local.get 0)
  (func $ogg_stream_init (type 8) (param i32 i32)
    (local i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const 8
      i32.add
      i32.const 0
      i32.const 352
      call $memset
      drop
      local.get 0
      i32.const 1024
      i32.store offset=24
      local.get 0
      i32.const 16384
      i32.store offset=4
      local.get 0
      i32.const 16384
      call $malloc
      local.tee 2
      i32.store
      local.get 0
      i32.const 4096
      call $malloc
      local.tee 3
      i32.store offset=16
      local.get 0
      i32.const 8192
      call $malloc
      local.tee 4
      i32.store offset=20
      block  ;; label = @2
        block  ;; label = @3
          local.get 2
          i32.eqz
          br_if 0 (;@3;)
          block  ;; label = @4
            local.get 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            br_if 2 (;@2;)
          end
          local.get 2
          call $free
        end
        block  ;; label = @3
          local.get 3
          i32.eqz
          br_if 0 (;@3;)
          local.get 3
          call $free
        end
        block  ;; label = @3
          local.get 4
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          call $free
        end
        local.get 0
        i32.const 0
        i32.const 360
        call $memset
        drop
        return
      end
      local.get 0
      local.get 1
      i32.store offset=336
    end)
  (func $_fetch_headers (type 9) (param i32 i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i64 i32 i32 i32 i32 i32 i32 i32 i32 i64 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 48
    i32.sub
    local.tee 6
    global.set $__stack_pointer
    block  ;; label = @1
      block  ;; label = @2
        local.get 5
        br_if 0 (;@2;)
        i32.const -128
        local.set 7
        local.get 0
        local.get 6
        i32.const 32
        i32.add
        i64.const 65535
        call $_get_next_page
        local.tee 8
        i64.const -128
        i64.eq
        br_if 1 (;@1;)
        local.get 6
        i32.const 32
        i32.add
        local.set 5
        local.get 8
        i64.const 0
        i64.ge_s
        br_if 0 (;@2;)
        i32.const -132
        local.set 7
        br 1 (;@1;)
      end
      local.get 1
      i64.const 0
      i64.store align=4
      local.get 1
      i32.const 24
      i32.add
      i32.const 0
      i32.store
      local.get 1
      i32.const 16
      i32.add
      i64.const 0
      i64.store align=4
      local.get 1
      i32.const 8
      i32.add
      i64.const 0
      i64.store align=4
      local.get 1
      i32.const 1
      i32.const 3240
      call $calloc
      i32.store offset=28
      local.get 2
      i32.const 8
      i32.add
      i64.const 0
      i64.store align=4
      local.get 2
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 2
      i32.store offset=88
      local.get 0
      i32.const 464
      i32.add
      local.set 9
      local.get 0
      i32.const 120
      i32.add
      local.set 10
      i32.const 2
      local.set 11
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            loop  ;; label = @5
              local.get 5
              i32.load
              local.tee 7
              i32.const 5
              i32.add
              i32.load8_u
              i32.const 2
              i32.and
              i32.eqz
              br_if 1 (;@4;)
              block  ;; label = @6
                local.get 3
                i32.eqz
                br_if 0 (;@6;)
                local.get 7
                i32.const 14
                i32.add
                i32.load align=1
                local.set 12
                local.get 4
                i32.load
                local.set 13
                block  ;; label = @7
                  local.get 3
                  i32.load
                  local.tee 14
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 13
                  local.set 7
                  local.get 14
                  local.set 11
                  local.get 13
                  i32.eqz
                  br_if 0 (;@7;)
                  block  ;; label = @8
                    loop  ;; label = @9
                      local.get 11
                      i32.load
                      local.get 12
                      i32.eq
                      br_if 1 (;@8;)
                      local.get 11
                      i32.const 4
                      i32.add
                      local.set 11
                      local.get 7
                      i32.const -1
                      i32.add
                      local.tee 7
                      i32.eqz
                      br_if 2 (;@7;)
                      br 0 (;@9;)
                    end
                  end
                  local.get 14
                  call $free
                  local.get 4
                  i32.const 0
                  i32.store
                  local.get 3
                  i32.const 0
                  i32.store
                  br 4 (;@3;)
                end
                local.get 4
                local.get 13
                i32.const 1
                i32.add
                local.tee 11
                i32.store
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 14
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 14
                    local.get 11
                    i32.const 2
                    i32.shl
                    call $realloc
                    local.set 11
                    local.get 4
                    i32.load
                    i32.const -1
                    i32.add
                    local.set 13
                    br 1 (;@7;)
                  end
                  i32.const 4
                  call $malloc
                  local.set 11
                end
                local.get 11
                local.get 13
                i32.const 2
                i32.shl
                i32.add
                local.get 12
                i32.store
                local.get 3
                local.get 11
                i32.store
                local.get 0
                i32.load offset=88
                local.set 11
              end
              block  ;; label = @6
                local.get 11
                i32.const 2
                i32.gt_s
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 10
                  i32.load
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 5
                  i32.load
                  i32.const 14
                  i32.add
                  i32.load align=1
                  local.set 11
                  local.get 0
                  i32.const -1
                  i32.store offset=460
                  local.get 0
                  i32.const 0
                  i32.store offset=452
                  local.get 0
                  i64.const 0
                  i64.store offset=444 align=4
                  local.get 0
                  i32.const 0
                  i32.store offset=156
                  local.get 0
                  i64.const 0
                  i64.store offset=148 align=4
                  local.get 0
                  i64.const 0
                  i64.store offset=128
                  local.get 9
                  i64.const 0
                  i64.store
                  local.get 9
                  i32.const 8
                  i32.add
                  i64.const 0
                  i64.store
                  local.get 0
                  local.get 11
                  i32.store offset=456
                end
                local.get 10
                local.get 5
                call $ogg_stream_pagein
                local.get 10
                i32.load
                local.tee 15
                i32.eqz
                br_if 0 (;@6;)
                local.get 0
                i32.load offset=152
                local.get 0
                i32.load offset=156
                local.tee 7
                i32.le_s
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 0
                  i32.load offset=136
                  local.get 7
                  i32.const 2
                  i32.shl
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 11
                  i32.const 1024
                  i32.and
                  br_if 0 (;@7;)
                  local.get 11
                  i32.const 256
                  i32.and
                  local.set 16
                  local.get 11
                  i32.const 512
                  i32.and
                  local.set 13
                  block  ;; label = @8
                    local.get 11
                    i32.const 255
                    i32.and
                    local.tee 12
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 14
                    i32.const 4
                    i32.add
                    local.set 11
                    i32.const 255
                    local.set 12
                    loop  ;; label = @9
                      i32.const 512
                      local.get 13
                      local.get 11
                      i32.load
                      local.tee 14
                      i32.const 512
                      i32.and
                      select
                      local.set 13
                      local.get 11
                      i32.const 4
                      i32.add
                      local.set 11
                      local.get 7
                      i32.const 1
                      i32.add
                      local.set 7
                      local.get 14
                      i32.const 255
                      i32.and
                      local.tee 14
                      local.get 12
                      i32.add
                      local.set 12
                      local.get 14
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                    end
                  end
                  local.get 0
                  local.get 7
                  i32.const 1
                  i32.add
                  i32.store offset=156
                  local.get 6
                  local.get 12
                  i32.store offset=4
                  local.get 0
                  local.get 0
                  i32.load offset=132
                  local.tee 11
                  local.get 12
                  i32.add
                  i32.store offset=132
                  local.get 6
                  local.get 0
                  i64.load offset=464
                  local.tee 8
                  i64.store offset=24
                  local.get 0
                  i32.load offset=140
                  local.get 7
                  i32.const 3
                  i32.shl
                  i32.add
                  i64.load
                  local.set 17
                  local.get 0
                  local.get 8
                  i64.const 1
                  i64.add
                  i64.store offset=464
                  local.get 6
                  local.get 16
                  i32.store offset=8
                  local.get 6
                  local.get 13
                  i32.store offset=12
                  local.get 6
                  local.get 15
                  local.get 11
                  i32.add
                  local.tee 11
                  i32.store
                  local.get 6
                  local.get 17
                  i64.store offset=16
                  local.get 16
                  i32.eqz
                  br_if 1 (;@6;)
                  local.get 12
                  i32.const 2147483644
                  i32.add
                  local.tee 13
                  i32.const 2147483645
                  i32.lt_u
                  br_if 1 (;@6;)
                  local.get 11
                  i32.load8_u
                  i32.const 1
                  i32.ne
                  br_if 1 (;@6;)
                  local.get 12
                  i32.const -4
                  i32.add
                  local.set 7
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 13
                      i32.const 2147483646
                      i32.lt_u
                      br_if 0 (;@9;)
                      local.get 11
                      i32.const 2
                      i32.add
                      local.set 14
                      local.get 11
                      i32.const 1
                      i32.add
                      i32.load8_u
                      local.set 11
                      i64.const 2
                      local.set 8
                      br 1 (;@8;)
                    end
                    local.get 12
                    i64.extend_i32_u
                    i64.const 4294967296
                    i64.or
                    local.set 8
                    i32.const 255
                    local.set 11
                    i32.const 0
                    local.set 14
                  end
                  local.get 8
                  i64.const 32
                  i64.shr_u
                  i32.wrap_i64
                  local.set 13
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 7
                        local.get 8
                        i32.wrap_i64
                        local.tee 15
                        i32.gt_s
                        br_if 0 (;@10;)
                        local.get 12
                        local.get 13
                        i32.const 15
                        i32.add
                        i32.const 3
                        i32.shr_u
                        i32.sub
                        local.get 15
                        i32.lt_s
                        br_if 1 (;@9;)
                      end
                      local.get 14
                      i32.load8_u
                      local.get 13
                      i32.shr_u
                      local.set 16
                      block  ;; label = @10
                        local.get 13
                        i32.const 8
                        i32.or
                        local.tee 18
                        i32.const 9
                        i32.lt_s
                        br_if 0 (;@10;)
                        local.get 14
                        i32.const 1
                        i32.add
                        i32.load8_u
                        i32.const 8
                        local.get 13
                        i32.sub
                        i32.shl
                        local.get 16
                        i32.or
                        local.set 16
                      end
                      local.get 8
                      i64.const 4294967296
                      i64.and
                      local.get 18
                      i32.const 3
                      i32.shr_u
                      local.tee 13
                      local.get 15
                      i32.add
                      i64.extend_i32_u
                      i64.or
                      local.set 8
                      local.get 16
                      i32.const 255
                      i32.and
                      local.set 18
                      local.get 14
                      local.get 13
                      i32.add
                      local.set 14
                      br 1 (;@8;)
                    end
                    local.get 12
                    i64.extend_i32_u
                    i64.const 4294967296
                    i64.or
                    local.set 8
                    i32.const -1
                    local.set 18
                    i32.const 0
                    local.set 14
                  end
                  local.get 8
                  i64.const 32
                  i64.shr_u
                  i32.wrap_i64
                  local.set 13
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 7
                        local.get 8
                        i32.wrap_i64
                        local.tee 15
                        i32.gt_s
                        br_if 0 (;@10;)
                        local.get 12
                        local.get 13
                        i32.const 15
                        i32.add
                        i32.const 3
                        i32.shr_u
                        i32.sub
                        local.get 15
                        i32.lt_s
                        br_if 1 (;@9;)
                      end
                      local.get 14
                      i32.load8_u
                      local.get 13
                      i32.shr_u
                      local.set 16
                      block  ;; label = @10
                        local.get 13
                        i32.const 8
                        i32.or
                        local.tee 19
                        i32.const 9
                        i32.lt_s
                        br_if 0 (;@10;)
                        local.get 14
                        i32.const 1
                        i32.add
                        i32.load8_u
                        i32.const 8
                        local.get 13
                        i32.sub
                        i32.shl
                        local.get 16
                        i32.or
                        local.set 16
                      end
                      local.get 8
                      i64.const 4294967296
                      i64.and
                      local.get 19
                      i32.const 3
                      i32.shr_u
                      local.tee 13
                      local.get 15
                      i32.add
                      i64.extend_i32_u
                      i64.or
                      local.set 8
                      local.get 16
                      i32.const 255
                      i32.and
                      local.set 20
                      local.get 14
                      local.get 13
                      i32.add
                      local.set 14
                      br 1 (;@8;)
                    end
                    local.get 12
                    i64.extend_i32_u
                    i64.const 4294967296
                    i64.or
                    local.set 8
                    i32.const -1
                    local.set 20
                    i32.const 0
                    local.set 14
                  end
                  local.get 8
                  i64.const 32
                  i64.shr_u
                  i32.wrap_i64
                  local.set 13
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 7
                        local.get 8
                        i32.wrap_i64
                        local.tee 15
                        i32.gt_s
                        br_if 0 (;@10;)
                        local.get 12
                        local.get 13
                        i32.const 15
                        i32.add
                        i32.const 3
                        i32.shr_u
                        i32.sub
                        local.get 15
                        i32.lt_s
                        br_if 1 (;@9;)
                      end
                      local.get 14
                      i32.load8_u
                      local.get 13
                      i32.shr_u
                      local.set 16
                      block  ;; label = @10
                        local.get 13
                        i32.const 8
                        i32.or
                        local.tee 19
                        i32.const 9
                        i32.lt_s
                        br_if 0 (;@10;)
                        local.get 14
                        i32.const 1
                        i32.add
                        i32.load8_u
                        i32.const 8
                        local.get 13
                        i32.sub
                        i32.shl
                        local.get 16
                        i32.or
                        local.set 16
                      end
                      local.get 8
                      i64.const 4294967296
                      i64.and
                      local.get 19
                      i32.const 3
                      i32.shr_u
                      local.tee 13
                      local.get 15
                      i32.add
                      i64.extend_i32_u
                      i64.or
                      local.set 8
                      local.get 16
                      i32.const 255
                      i32.and
                      local.set 21
                      local.get 14
                      local.get 13
                      i32.add
                      local.set 14
                      br 1 (;@8;)
                    end
                    local.get 12
                    i64.extend_i32_u
                    i64.const 4294967296
                    i64.or
                    local.set 8
                    i32.const -1
                    local.set 21
                    i32.const 0
                    local.set 14
                  end
                  local.get 8
                  i64.const 32
                  i64.shr_u
                  i32.wrap_i64
                  local.set 13
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 7
                        local.get 8
                        i32.wrap_i64
                        local.tee 15
                        i32.gt_s
                        br_if 0 (;@10;)
                        local.get 12
                        local.get 13
                        i32.const 15
                        i32.add
                        i32.const 3
                        i32.shr_u
                        i32.sub
                        local.get 15
                        i32.lt_s
                        br_if 1 (;@9;)
                      end
                      local.get 14
                      i32.load8_u
                      local.get 13
                      i32.shr_u
                      local.set 16
                      block  ;; label = @10
                        local.get 13
                        i32.const 8
                        i32.or
                        local.tee 19
                        i32.const 9
                        i32.lt_s
                        br_if 0 (;@10;)
                        local.get 14
                        i32.const 1
                        i32.add
                        i32.load8_u
                        i32.const 8
                        local.get 13
                        i32.sub
                        i32.shl
                        local.get 16
                        i32.or
                        local.set 16
                      end
                      local.get 8
                      i64.const 4294967296
                      i64.and
                      local.get 19
                      i32.const 3
                      i32.shr_u
                      local.tee 13
                      local.get 15
                      i32.add
                      i64.extend_i32_u
                      i64.or
                      local.set 8
                      local.get 16
                      i32.const 255
                      i32.and
                      local.set 19
                      local.get 14
                      local.get 13
                      i32.add
                      local.set 14
                      br 1 (;@8;)
                    end
                    local.get 12
                    i64.extend_i32_u
                    i64.const 4294967296
                    i64.or
                    local.set 8
                    i32.const -1
                    local.set 19
                    i32.const 0
                    local.set 14
                  end
                  local.get 8
                  i64.const 32
                  i64.shr_u
                  i32.wrap_i64
                  local.set 13
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 7
                      local.get 8
                      i32.wrap_i64
                      local.tee 15
                      i32.gt_s
                      br_if 0 (;@9;)
                      i32.const -1
                      local.set 16
                      local.get 12
                      local.get 13
                      i32.const 15
                      i32.add
                      i32.const 3
                      i32.shr_u
                      i32.sub
                      local.get 15
                      i32.lt_s
                      br_if 1 (;@8;)
                    end
                    local.get 14
                    i32.load8_u
                    local.get 13
                    i32.shr_u
                    local.set 7
                    block  ;; label = @9
                      local.get 13
                      i32.const 8
                      i32.or
                      i32.const 9
                      i32.lt_s
                      br_if 0 (;@9;)
                      local.get 14
                      i32.const 1
                      i32.add
                      i32.load8_u
                      i32.const 8
                      local.get 13
                      i32.sub
                      i32.shl
                      local.get 7
                      i32.or
                      local.set 7
                    end
                    local.get 7
                    i32.const 255
                    i32.and
                    local.set 16
                  end
                  i32.const -118
                  local.set 7
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 11
                      i32.const 255
                      i32.and
                      i32.const 118
                      i32.ne
                      br_if 0 (;@9;)
                      block  ;; label = @10
                        local.get 18
                        i32.const 255
                        i32.and
                        i32.const 111
                        i32.eq
                        br_if 0 (;@10;)
                        i32.const -111
                        local.set 7
                        local.get 18
                        local.set 11
                        br 1 (;@9;)
                      end
                      block  ;; label = @10
                        local.get 20
                        i32.const 255
                        i32.and
                        i32.const 114
                        i32.eq
                        br_if 0 (;@10;)
                        i32.const -114
                        local.set 7
                        local.get 20
                        local.set 11
                        br 1 (;@9;)
                      end
                      block  ;; label = @10
                        local.get 21
                        i32.const 255
                        i32.and
                        i32.const 98
                        i32.eq
                        br_if 0 (;@10;)
                        i32.const -98
                        local.set 7
                        local.get 21
                        local.set 11
                        br 1 (;@9;)
                      end
                      block  ;; label = @10
                        local.get 19
                        i32.const 255
                        i32.and
                        i32.const 105
                        i32.eq
                        br_if 0 (;@10;)
                        i32.const -105
                        local.set 7
                        local.get 19
                        local.set 11
                        br 1 (;@9;)
                      end
                      local.get 16
                      i32.const 255
                      i32.and
                      i32.const 115
                      i32.eq
                      br_if 1 (;@8;)
                      i32.const -115
                      local.set 7
                      local.get 16
                      local.set 11
                    end
                    local.get 7
                    i32.const 0
                    local.get 11
                    i32.const 255
                    i32.and
                    i32.sub
                    i32.ne
                    br_if 2 (;@6;)
                  end
                  local.get 0
                  i32.const 3
                  i32.store offset=88
                  local.get 1
                  local.get 2
                  local.get 6
                  call $vorbis_synthesis_headerin
                  i32.eqz
                  br_if 1 (;@6;)
                  br 4 (;@3;)
                end
                local.get 0
                local.get 7
                i32.const 1
                i32.add
                i32.store offset=156
                local.get 0
                local.get 0
                i64.load offset=464
                i64.const 1
                i64.add
                i64.store offset=464
              end
              block  ;; label = @6
                local.get 0
                local.get 5
                i64.const 65535
                call $_get_next_page
                local.tee 8
                i64.const -128
                i64.ne
                br_if 0 (;@6;)
                i32.const -128
                local.set 7
                br 4 (;@2;)
              end
              block  ;; label = @6
                local.get 8
                i64.const 0
                i64.ge_s
                br_if 0 (;@6;)
                i32.const -132
                local.set 7
                br 4 (;@2;)
              end
              local.get 0
              i32.load offset=88
              local.tee 11
              i32.const 3
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              i32.load offset=456
              local.get 5
              i32.load
              i32.const 14
              i32.add
              i32.load align=1
              i32.ne
              br_if 0 (;@5;)
            end
            local.get 10
            local.get 5
            call $ogg_stream_pagein
            local.get 0
            i32.load offset=88
            local.set 11
          end
          i32.const -132
          local.set 7
          local.get 11
          i32.const 3
          i32.ne
          br_if 1 (;@2;)
          i32.const 0
          local.set 14
          i32.const 0
          local.set 15
          block  ;; label = @4
            loop  ;; label = @5
              block  ;; label = @6
                local.get 10
                i32.load
                local.tee 4
                i32.eqz
                br_if 0 (;@6;)
                local.get 0
                i32.load offset=152
                local.get 0
                i32.load offset=156
                local.tee 7
                i32.le_s
                br_if 0 (;@6;)
                local.get 0
                i32.load offset=136
                local.get 7
                i32.const 2
                i32.shl
                i32.add
                local.tee 3
                i32.load
                local.tee 11
                i32.const 1024
                i32.and
                br_if 2 (;@4;)
                local.get 11
                i32.const 256
                i32.and
                local.set 9
                local.get 11
                i32.const 512
                i32.and
                local.set 13
                block  ;; label = @7
                  local.get 11
                  i32.const 255
                  i32.and
                  local.tee 12
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 3
                  i32.const 4
                  i32.add
                  local.set 11
                  i32.const 255
                  local.set 12
                  loop  ;; label = @8
                    i32.const 512
                    local.get 13
                    local.get 11
                    i32.load
                    local.tee 3
                    i32.const 512
                    i32.and
                    select
                    local.set 13
                    local.get 11
                    i32.const 4
                    i32.add
                    local.set 11
                    local.get 7
                    i32.const 1
                    i32.add
                    local.set 7
                    local.get 3
                    i32.const 255
                    i32.and
                    local.tee 3
                    local.get 12
                    i32.add
                    local.set 12
                    local.get 3
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                  end
                end
                local.get 0
                local.get 7
                i32.const 1
                i32.add
                i32.store offset=156
                local.get 6
                local.get 12
                i32.store offset=4
                local.get 0
                local.get 0
                i32.load offset=132
                local.tee 11
                local.get 12
                i32.add
                i32.store offset=132
                local.get 6
                local.get 0
                i64.load offset=464
                local.tee 8
                i64.store offset=24
                local.get 0
                i32.load offset=140
                local.get 7
                i32.const 3
                i32.shl
                i32.add
                i64.load
                local.set 17
                local.get 0
                local.get 8
                i64.const 1
                i64.add
                i64.store offset=464
                local.get 6
                local.get 9
                i32.store offset=8
                local.get 6
                local.get 13
                i32.store offset=12
                local.get 6
                local.get 4
                local.get 11
                i32.add
                i32.store
                local.get 6
                local.get 17
                i64.store offset=16
                local.get 1
                local.get 2
                local.get 6
                call $vorbis_synthesis_headerin
                local.tee 7
                br_if 4 (;@2;)
                local.get 14
                i32.const 1
                i32.eq
                local.set 11
                i32.const 0
                local.set 7
                local.get 14
                i32.const 1
                i32.add
                local.set 14
                local.get 11
                i32.eqz
                br_if 1 (;@5;)
                br 5 (;@1;)
              end
              block  ;; label = @6
                local.get 14
                i32.const 1
                i32.le_s
                br_if 0 (;@6;)
                i32.const 0
                local.set 7
                br 5 (;@1;)
              end
              loop  ;; label = @6
                local.get 15
                local.set 12
                block  ;; label = @7
                  loop  ;; label = @8
                    i32.const -133
                    local.set 7
                    local.get 0
                    local.get 5
                    i64.const 65535
                    call $_get_next_page
                    i64.const 0
                    i64.lt_s
                    br_if 6 (;@2;)
                    local.get 0
                    i32.load offset=456
                    local.get 5
                    i32.load
                    local.tee 11
                    i32.const 14
                    i32.add
                    i32.load align=1
                    i32.eq
                    br_if 1 (;@7;)
                    local.get 11
                    i32.const 5
                    i32.add
                    i32.load8_u
                    i32.const 2
                    i32.and
                    i32.eqz
                    br_if 0 (;@8;)
                  end
                  i32.const 1
                  local.set 15
                  local.get 12
                  i32.eqz
                  br_if 1 (;@6;)
                  br 5 (;@2;)
                end
              end
              local.get 10
              local.get 5
              call $ogg_stream_pagein
              local.get 12
              local.set 15
              br 0 (;@5;)
            end
          end
          local.get 0
          local.get 7
          i32.const 1
          i32.add
          i32.store offset=156
          local.get 0
          local.get 0
          i64.load offset=464
          i64.const 1
          i64.add
          i64.store offset=464
        end
        i32.const -133
        local.set 7
      end
      local.get 1
      call $vorbis_info_clear
      local.get 2
      call $vorbis_comment_clear
      local.get 0
      i32.const 2
      i32.store offset=88
    end
    local.get 6
    i32.const 48
    i32.add
    global.set $__stack_pointer
    local.get 7)
  (func $ov_clear (type 4) (param i32)
    (local i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const 560
      i32.add
      call $vorbis_block_clear
      local.get 0
      i32.const 480
      i32.add
      call $vorbis_dsp_clear
      block  ;; label = @2
        local.get 0
        i32.load offset=120
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.const 136
        i32.add
        i32.load
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      local.get 0
      i32.const 120
      i32.add
      local.set 1
      block  ;; label = @2
        local.get 0
        i32.const 140
        i32.add
        i32.load
        local.tee 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        call $free
      end
      local.get 1
      i32.const 0
      i32.const 360
      call $memset
      drop
      block  ;; label = @2
        local.get 0
        i32.load offset=72
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        i32.load offset=52
        local.tee 2
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 2
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 1
          i32.const 0
          local.set 2
          i32.const 0
          local.set 3
          loop  ;; label = @4
            local.get 0
            i32.load offset=72
            local.get 1
            i32.add
            call $vorbis_info_clear
            local.get 0
            i32.load offset=76
            local.get 2
            i32.add
            call $vorbis_comment_clear
            local.get 1
            i32.const 32
            i32.add
            local.set 1
            local.get 2
            i32.const 16
            i32.add
            local.set 2
            local.get 3
            i32.const 1
            i32.add
            local.tee 3
            local.get 0
            i32.load offset=52
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 0
          i32.load offset=72
          local.set 1
        end
        local.get 1
        call $free
        local.get 0
        i32.load offset=76
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=60
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=68
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=64
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=56
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      local.get 0
      i32.const 24
      i32.add
      local.set 1
      block  ;; label = @2
        local.get 0
        i32.load offset=24
        local.tee 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        call $free
      end
      local.get 1
      i64.const 0
      i64.store align=4
      local.get 1
      i32.const 24
      i32.add
      i32.const 0
      i32.store
      local.get 1
      i32.const 16
      i32.add
      i64.const 0
      i64.store align=4
      local.get 1
      i32.const 8
      i32.add
      i64.const 0
      i64.store align=4
      block  ;; label = @2
        local.get 0
        i32.load
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        i32.const 656
        i32.add
        i32.load
        local.tee 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        local.get 2
        call_indirect (type 1)
        drop
      end
      local.get 0
      i32.const 0
      i32.const 664
      call $memset
      drop
    end)
  (func $memcpy (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      block  ;; label = @2
        local.get 1
        i32.const 3
        i32.and
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        local.get 1
        i32.load8_u
        i32.store8
        local.get 2
        i32.const -1
        i32.add
        local.set 3
        local.get 0
        i32.const 1
        i32.add
        local.set 4
        local.get 1
        i32.const 1
        i32.add
        local.tee 5
        i32.const 3
        i32.and
        i32.eqz
        br_if 1 (;@1;)
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        local.get 1
        i32.load8_u offset=1
        i32.store8 offset=1
        local.get 2
        i32.const -2
        i32.add
        local.set 3
        local.get 0
        i32.const 2
        i32.add
        local.set 4
        local.get 1
        i32.const 2
        i32.add
        local.tee 5
        i32.const 3
        i32.and
        i32.eqz
        br_if 1 (;@1;)
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        local.get 1
        i32.load8_u offset=2
        i32.store8 offset=2
        local.get 2
        i32.const -3
        i32.add
        local.set 3
        local.get 0
        i32.const 3
        i32.add
        local.set 4
        local.get 1
        i32.const 3
        i32.add
        local.tee 5
        i32.const 3
        i32.and
        i32.eqz
        br_if 1 (;@1;)
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        local.get 1
        i32.load8_u offset=3
        i32.store8 offset=3
        local.get 2
        i32.const -4
        i32.add
        local.set 3
        local.get 0
        i32.const 4
        i32.add
        local.set 4
        local.get 1
        i32.const 4
        i32.add
        local.set 5
        br 1 (;@1;)
      end
      local.get 2
      local.set 3
      local.get 0
      local.set 4
      local.get 1
      local.set 5
    end
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          local.get 4
          i32.const 3
          i32.and
          local.tee 2
          br_if 0 (;@3;)
          block  ;; label = @4
            block  ;; label = @5
              local.get 3
              i32.const 16
              i32.ge_u
              br_if 0 (;@5;)
              local.get 3
              local.set 1
              br 1 (;@4;)
            end
            block  ;; label = @5
              block  ;; label = @6
                local.get 3
                i32.const -16
                i32.add
                local.tee 1
                i32.const 16
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 3
                local.set 1
                br 1 (;@5;)
              end
              local.get 4
              local.get 5
              i64.load align=4
              i64.store align=4
              local.get 4
              local.get 5
              i64.load offset=8 align=4
              i64.store offset=8 align=4
              local.get 4
              i32.const 16
              i32.add
              local.set 4
              local.get 5
              i32.const 16
              i32.add
              local.set 5
              local.get 1
              i32.const 16
              i32.lt_u
              br_if 1 (;@4;)
            end
            loop  ;; label = @5
              local.get 4
              local.get 5
              i64.load align=4
              i64.store align=4
              local.get 4
              local.get 5
              i64.load offset=8 align=4
              i64.store offset=8 align=4
              local.get 4
              local.get 5
              i64.load offset=16 align=4
              i64.store offset=16 align=4
              local.get 4
              local.get 5
              i64.load offset=24 align=4
              i64.store offset=24 align=4
              local.get 4
              i32.const 32
              i32.add
              local.set 4
              local.get 5
              i32.const 32
              i32.add
              local.set 5
              local.get 1
              i32.const -32
              i32.add
              local.tee 1
              i32.const 15
              i32.gt_u
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 1
            i32.const 8
            i32.lt_u
            br_if 0 (;@4;)
            local.get 4
            local.get 5
            i64.load align=4
            i64.store align=4
            local.get 5
            i32.const 8
            i32.add
            local.set 5
            local.get 4
            i32.const 8
            i32.add
            local.set 4
          end
          block  ;; label = @4
            local.get 1
            i32.const 4
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            local.get 5
            i32.load
            i32.store
            local.get 5
            i32.const 4
            i32.add
            local.set 5
            local.get 4
            i32.const 4
            i32.add
            local.set 4
          end
          block  ;; label = @4
            local.get 1
            i32.const 2
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            local.get 5
            i32.load16_u align=1
            i32.store16 align=1
            local.get 4
            i32.const 2
            i32.add
            local.set 4
            local.get 5
            i32.const 2
            i32.add
            local.set 5
          end
          local.get 1
          i32.const 1
          i32.and
          br_if 1 (;@2;)
          br 2 (;@1;)
        end
        block  ;; label = @3
          local.get 3
          i32.const 32
          i32.lt_u
          br_if 0 (;@3;)
          local.get 5
          i32.load
          local.set 1
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                i32.const -1
                i32.add
                br_table 0 (;@6;) 1 (;@5;) 2 (;@4;) 0 (;@6;)
              end
              local.get 4
              local.get 1
              i32.store8
              local.get 4
              local.get 1
              i32.const 16
              i32.shr_u
              i32.store8 offset=2
              local.get 4
              local.get 1
              i32.const 8
              i32.shr_u
              i32.store8 offset=1
              local.get 3
              i32.const -3
              i32.add
              local.set 3
              local.get 4
              i32.const 3
              i32.add
              local.set 6
              i32.const 0
              local.set 2
              loop  ;; label = @6
                local.get 6
                local.get 2
                i32.add
                local.tee 4
                local.get 5
                local.get 2
                i32.add
                local.tee 7
                i32.const 4
                i32.add
                i32.load
                local.tee 8
                i32.const 8
                i32.shl
                local.get 1
                i32.const 24
                i32.shr_u
                i32.or
                i32.store
                local.get 4
                i32.const 4
                i32.add
                local.get 7
                i32.const 8
                i32.add
                i32.load
                local.tee 1
                i32.const 8
                i32.shl
                local.get 8
                i32.const 24
                i32.shr_u
                i32.or
                i32.store
                local.get 4
                i32.const 8
                i32.add
                local.get 7
                i32.const 12
                i32.add
                i32.load
                local.tee 8
                i32.const 8
                i32.shl
                local.get 1
                i32.const 24
                i32.shr_u
                i32.or
                i32.store
                local.get 4
                i32.const 12
                i32.add
                local.get 7
                i32.const 16
                i32.add
                i32.load
                local.tee 1
                i32.const 8
                i32.shl
                local.get 8
                i32.const 24
                i32.shr_u
                i32.or
                i32.store
                local.get 2
                i32.const 16
                i32.add
                local.set 2
                local.get 3
                i32.const -16
                i32.add
                local.tee 3
                i32.const 16
                i32.gt_u
                br_if 0 (;@6;)
              end
              local.get 6
              local.get 2
              i32.add
              local.set 4
              local.get 5
              local.get 2
              i32.add
              i32.const 3
              i32.add
              local.set 5
              br 2 (;@3;)
            end
            local.get 4
            local.get 1
            i32.store16 align=1
            local.get 3
            i32.const -2
            i32.add
            local.set 3
            local.get 4
            i32.const 2
            i32.add
            local.set 6
            i32.const 0
            local.set 2
            loop  ;; label = @5
              local.get 6
              local.get 2
              i32.add
              local.tee 4
              local.get 5
              local.get 2
              i32.add
              local.tee 7
              i32.const 4
              i32.add
              i32.load
              local.tee 8
              i32.const 16
              i32.shl
              local.get 1
              i32.const 16
              i32.shr_u
              i32.or
              i32.store
              local.get 4
              i32.const 4
              i32.add
              local.get 7
              i32.const 8
              i32.add
              i32.load
              local.tee 1
              i32.const 16
              i32.shl
              local.get 8
              i32.const 16
              i32.shr_u
              i32.or
              i32.store
              local.get 4
              i32.const 8
              i32.add
              local.get 7
              i32.const 12
              i32.add
              i32.load
              local.tee 8
              i32.const 16
              i32.shl
              local.get 1
              i32.const 16
              i32.shr_u
              i32.or
              i32.store
              local.get 4
              i32.const 12
              i32.add
              local.get 7
              i32.const 16
              i32.add
              i32.load
              local.tee 1
              i32.const 16
              i32.shl
              local.get 8
              i32.const 16
              i32.shr_u
              i32.or
              i32.store
              local.get 2
              i32.const 16
              i32.add
              local.set 2
              local.get 3
              i32.const -16
              i32.add
              local.tee 3
              i32.const 17
              i32.gt_u
              br_if 0 (;@5;)
            end
            local.get 6
            local.get 2
            i32.add
            local.set 4
            local.get 5
            local.get 2
            i32.add
            i32.const 2
            i32.add
            local.set 5
            br 1 (;@3;)
          end
          local.get 4
          local.get 1
          i32.store8
          local.get 3
          i32.const -1
          i32.add
          local.set 3
          local.get 4
          i32.const 1
          i32.add
          local.set 6
          i32.const 0
          local.set 2
          loop  ;; label = @4
            local.get 6
            local.get 2
            i32.add
            local.tee 4
            local.get 5
            local.get 2
            i32.add
            local.tee 7
            i32.const 4
            i32.add
            i32.load
            local.tee 8
            i32.const 24
            i32.shl
            local.get 1
            i32.const 8
            i32.shr_u
            i32.or
            i32.store
            local.get 4
            i32.const 4
            i32.add
            local.get 7
            i32.const 8
            i32.add
            i32.load
            local.tee 1
            i32.const 24
            i32.shl
            local.get 8
            i32.const 8
            i32.shr_u
            i32.or
            i32.store
            local.get 4
            i32.const 8
            i32.add
            local.get 7
            i32.const 12
            i32.add
            i32.load
            local.tee 8
            i32.const 24
            i32.shl
            local.get 1
            i32.const 8
            i32.shr_u
            i32.or
            i32.store
            local.get 4
            i32.const 12
            i32.add
            local.get 7
            i32.const 16
            i32.add
            i32.load
            local.tee 1
            i32.const 24
            i32.shl
            local.get 8
            i32.const 8
            i32.shr_u
            i32.or
            i32.store
            local.get 2
            i32.const 16
            i32.add
            local.set 2
            local.get 3
            i32.const -16
            i32.add
            local.tee 3
            i32.const 18
            i32.gt_u
            br_if 0 (;@4;)
          end
          local.get 6
          local.get 2
          i32.add
          local.set 4
          local.get 5
          local.get 2
          i32.add
          i32.const 1
          i32.add
          local.set 5
        end
        block  ;; label = @3
          local.get 3
          i32.const 16
          i32.lt_u
          br_if 0 (;@3;)
          local.get 4
          local.get 5
          i32.load8_u
          i32.store8
          local.get 4
          local.get 5
          i32.load offset=1 align=1
          i32.store offset=1 align=1
          local.get 4
          local.get 5
          i64.load offset=5 align=1
          i64.store offset=5 align=1
          local.get 4
          local.get 5
          i32.load16_u offset=13 align=1
          i32.store16 offset=13 align=1
          local.get 4
          local.get 5
          i32.load8_u offset=15
          i32.store8 offset=15
          local.get 4
          i32.const 16
          i32.add
          local.set 4
          local.get 5
          i32.const 16
          i32.add
          local.set 5
        end
        block  ;; label = @3
          local.get 3
          i32.const 8
          i32.and
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          local.get 5
          i64.load align=1
          i64.store align=1
          local.get 4
          i32.const 8
          i32.add
          local.set 4
          local.get 5
          i32.const 8
          i32.add
          local.set 5
        end
        block  ;; label = @3
          local.get 3
          i32.const 4
          i32.and
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          local.get 5
          i32.load align=1
          i32.store align=1
          local.get 4
          i32.const 4
          i32.add
          local.set 4
          local.get 5
          i32.const 4
          i32.add
          local.set 5
        end
        block  ;; label = @3
          local.get 3
          i32.const 2
          i32.and
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          local.get 5
          i32.load16_u align=1
          i32.store16 align=1
          local.get 4
          i32.const 2
          i32.add
          local.set 4
          local.get 5
          i32.const 2
          i32.add
          local.set 5
        end
        local.get 3
        i32.const 1
        i32.and
        i32.eqz
        br_if 1 (;@1;)
      end
      local.get 4
      local.get 5
      i32.load8_u
      i32.store8
    end
    local.get 0)
  (func $free (type 4) (param i32)
    (local i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const -4
      i32.add
      local.tee 1
      i32.load
      local.set 2
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.const -8
          i32.add
          i32.load
          local.tee 0
          local.get 0
          i32.const -2
          i32.and
          local.tee 3
          i32.ne
          br_if 0 (;@3;)
          local.get 2
          local.set 3
          local.get 1
          local.set 0
          br 1 (;@2;)
        end
        local.get 1
        local.get 3
        i32.sub
        local.tee 0
        i32.load offset=4
        local.get 0
        i32.load offset=8
        local.tee 4
        i32.store offset=8
        local.get 4
        local.get 0
        i32.load offset=4
        i32.store offset=4
        local.get 3
        local.get 2
        i32.add
        local.set 3
        local.get 1
        i32.load
        local.set 2
      end
      block  ;; label = @2
        local.get 1
        local.get 2
        i32.add
        local.tee 1
        i32.load
        local.tee 2
        local.get 1
        local.get 2
        i32.add
        i32.const -4
        i32.add
        i32.load
        i32.eq
        br_if 0 (;@2;)
        local.get 1
        i32.load offset=4
        local.get 1
        i32.load offset=8
        local.tee 2
        i32.store offset=8
        local.get 2
        local.get 1
        i32.load offset=4
        i32.store offset=4
        local.get 1
        i32.load
        local.get 3
        i32.add
        local.set 3
      end
      local.get 0
      local.get 3
      i32.store
      local.get 0
      local.get 3
      i32.const -4
      i32.and
      i32.add
      i32.const -4
      i32.add
      local.get 3
      i32.const 1
      i32.or
      i32.store
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.load
          i32.const -8
          i32.add
          local.tee 3
          i32.const 127
          i32.gt_u
          br_if 0 (;@3;)
          local.get 3
          i32.const 3
          i32.shr_u
          i32.const -1
          i32.add
          local.set 3
          br 1 (;@2;)
        end
        local.get 3
        i32.clz
        local.set 1
        block  ;; label = @3
          local.get 3
          i32.const 4095
          i32.gt_u
          br_if 0 (;@3;)
          local.get 3
          i32.const 29
          local.get 1
          i32.sub
          i32.shr_u
          i32.const 4
          i32.xor
          local.get 1
          i32.const 2
          i32.shl
          i32.sub
          i32.const 110
          i32.add
          local.set 3
          br 1 (;@2;)
        end
        local.get 3
        i32.const 30
        local.get 1
        i32.sub
        i32.shr_u
        i32.const 2
        i32.xor
        local.get 1
        i32.const 1
        i32.shl
        i32.sub
        i32.const 71
        i32.add
        local.tee 3
        i32.const 63
        local.get 3
        i32.const 63
        i32.lt_u
        select
        local.set 3
      end
      local.get 0
      local.get 3
      i32.const 4
      i32.shl
      local.tee 1
      i32.const 16798352
      i32.add
      i32.store offset=4
      local.get 0
      local.get 1
      i32.const 16798360
      i32.add
      local.tee 1
      i32.load
      i32.store offset=8
      local.get 1
      local.get 0
      i32.store
      local.get 0
      i32.load offset=8
      local.get 0
      i32.store offset=4
      i32.const 0
      i32.const 0
      i64.load offset=16799496
      i64.const 1
      local.get 3
      i64.extend_i32_u
      i64.shl
      i64.or
      i64.store offset=16799496
    end)
  (func $_initial_pcmoffset (type 10) (param i32 i32) (result i64)
    (local i32 i32 i32 i32 i32 i64 i32 i32 i64 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 0
    i32.const 120
    i32.add
    local.set 3
    local.get 0
    i32.const 456
    i32.add
    i32.load
    local.set 4
    local.get 1
    i32.const 28
    i32.add
    local.set 5
    i32.const -1
    local.set 6
    i64.const 0
    local.set 7
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        local.get 2
        i64.const -1
        call $_get_next_page
        i64.const 0
        i64.lt_s
        br_if 1 (;@1;)
        local.get 2
        i32.load
        local.tee 1
        i32.const 5
        i32.add
        i32.load8_u
        i32.const 2
        i32.and
        br_if 1 (;@1;)
        local.get 1
        i32.const 14
        i32.add
        i32.load align=1
        local.get 4
        i32.ne
        br_if 0 (;@2;)
        local.get 3
        local.get 2
        call $ogg_stream_pagein
        local.get 3
        i32.load
        local.set 8
        local.get 6
        local.set 9
        local.get 7
        local.set 10
        loop  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              local.get 8
              i32.eqz
              br_if 0 (;@5;)
              local.get 0
              i32.load offset=152
              local.get 0
              i32.load offset=156
              local.tee 1
              i32.gt_s
              br_if 1 (;@4;)
              local.get 9
              local.set 6
              local.get 10
              local.set 7
            end
            local.get 2
            i32.load
            i32.const 6
            i32.add
            i64.load align=1
            local.tee 10
            i64.const -1
            i64.eq
            br_if 2 (;@2;)
            local.get 10
            local.get 7
            i64.sub
            local.set 7
            br 3 (;@1;)
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=136
            local.get 1
            i32.const 2
            i32.shl
            i32.add
            local.tee 11
            i32.load
            local.tee 12
            i32.const 1024
            i32.and
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 12
              i32.const 255
              i32.and
              local.tee 13
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 11
              i32.const 4
              i32.add
              local.set 12
              i32.const 255
              local.set 13
              loop  ;; label = @6
                local.get 1
                i32.const 1
                i32.add
                local.set 1
                local.get 12
                i32.load8_u
                local.tee 11
                local.get 13
                i32.add
                local.set 13
                local.get 12
                i32.const 4
                i32.add
                local.set 12
                local.get 11
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
              end
            end
            local.get 0
            local.get 1
            i32.const 1
            i32.add
            i32.store offset=156
            local.get 0
            local.get 0
            i32.load offset=132
            local.tee 1
            local.get 13
            i32.add
            i32.store offset=132
            local.get 0
            local.get 0
            i64.load offset=464
            i64.const 1
            i64.add
            i64.store offset=464
            local.get 10
            i32.const 0
            local.get 5
            i32.load
            local.get 8
            local.get 1
            i32.add
            local.get 13
            call $vorbis_packet_blocksize
            local.tee 1
            local.get 9
            i32.add
            i32.const 2
            i32.shr_s
            local.get 9
            i32.const -1
            i32.eq
            select
            i64.extend_i32_s
            i64.add
            local.set 10
            local.get 1
            local.set 9
            br 1 (;@3;)
          end
          local.get 0
          local.get 1
          i32.const 1
          i32.add
          i32.store offset=156
          local.get 0
          local.get 0
          i64.load offset=464
          i64.const 1
          i64.add
          i64.store offset=464
          br 0 (;@3;)
        end
      end
    end
    local.get 2
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get 7
    i64.const 0
    local.get 7
    i64.const 0
    i64.gt_s
    select)
  (func $_get_prev_page_serial (type 11) (param i32 i64 i32 i32 i32 i32) (result i64)
    (local i32 i32 i32 i32 i32 i64 i32 i64 i64 i32 i64 i32 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 6
    global.set $__stack_pointer
    local.get 2
    i32.eqz
    local.get 3
    i32.eqz
    i32.or
    local.set 7
    local.get 0
    i32.const 32
    i32.add
    local.tee 8
    i32.const 16
    i32.add
    local.set 9
    local.get 8
    i32.const 8
    i32.add
    local.set 10
    i64.const -1
    local.set 11
    i32.const -1
    local.set 12
    i64.const -1
    local.set 13
    local.get 1
    local.set 14
    block  ;; label = @1
      loop  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.load
          local.tee 15
          br_if 0 (;@3;)
          i64.const -129
          local.set 16
          br 2 (;@1;)
        end
        block  ;; label = @3
          local.get 0
          i64.load offset=8
          local.get 14
          i64.const 65535
          local.get 14
          i64.const 65535
          i64.gt_s
          select
          i64.const -65535
          i64.add
          local.tee 14
          i64.eq
          br_if 0 (;@3;)
          i64.const -128
          local.set 16
          local.get 0
          i32.load offset=652
          local.tee 17
          i32.eqz
          br_if 2 (;@1;)
          local.get 15
          local.get 14
          i32.const 0
          local.get 17
          call_indirect (type 0)
          i32.const -1
          i32.eq
          br_if 2 (;@1;)
          local.get 0
          local.get 14
          i64.store offset=8
          local.get 0
          i32.load offset=28
          i32.const 0
          i32.lt_s
          br_if 0 (;@3;)
          local.get 8
          i64.const 0
          i64.store align=4
          local.get 9
          i32.const 0
          i32.store
          local.get 10
          i64.const 0
          i64.store align=4
        end
        i64.const -1
        local.set 18
        block  ;; label = @3
          local.get 14
          local.get 1
          i64.ge_s
          br_if 0 (;@3;)
          i64.const -1
          local.set 18
          local.get 14
          local.set 19
          loop  ;; label = @4
            local.get 18
            local.set 20
            i64.const -128
            local.set 16
            local.get 0
            local.get 6
            local.get 1
            local.get 19
            i64.sub
            call $_get_next_page
            local.tee 18
            i64.const -128
            i64.eq
            br_if 3 (;@1;)
            block  ;; label = @5
              local.get 18
              i64.const 0
              i64.ge_s
              br_if 0 (;@5;)
              local.get 20
              local.set 18
              br 2 (;@3;)
            end
            local.get 6
            i32.load
            local.tee 15
            i32.const 6
            i32.add
            i64.load align=1
            local.set 11
            block  ;; label = @5
              local.get 15
              i32.const 14
              i32.add
              i32.load align=1
              local.tee 12
              local.get 4
              i32.load
              i32.ne
              br_if 0 (;@5;)
              local.get 5
              local.get 11
              i64.store
              local.get 18
              local.set 13
            end
            local.get 3
            local.set 17
            local.get 2
            local.set 15
            block  ;; label = @5
              block  ;; label = @6
                local.get 7
                i32.eqz
                br_if 0 (;@6;)
                i64.const -1
                local.set 13
                br 1 (;@5;)
              end
              loop  ;; label = @6
                local.get 15
                i32.load
                local.get 12
                i32.eq
                br_if 1 (;@5;)
                local.get 15
                i32.const 4
                i32.add
                local.set 15
                local.get 17
                i32.const -1
                i32.add
                local.tee 17
                br_if 0 (;@6;)
              end
              i64.const -1
              local.set 13
            end
            local.get 0
            i64.load offset=8
            local.tee 19
            local.get 1
            i64.lt_s
            br_if 0 (;@4;)
          end
        end
        local.get 18
        i64.const -1
        i64.eq
        br_if 0 (;@2;)
      end
      local.get 13
      local.set 16
      local.get 13
      i64.const -1
      i64.gt_s
      br_if 0 (;@1;)
      local.get 5
      local.get 11
      i64.store
      local.get 4
      local.get 12
      i32.store
      local.get 18
      local.set 16
    end
    local.get 6
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get 16)
  (func $_bisect_forward_serialno (type 12) (param i32 i64 i64 i64 i64 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i64 i64 i32 i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 9
    global.set $__stack_pointer
    local.get 9
    local.get 4
    i64.store offset=104
    local.get 9
    i64.const -1
    i64.store offset=88
    local.get 0
    i32.const 456
    i32.add
    i32.load
    local.set 10
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          local.get 6
          i32.eqz
          local.get 7
          i32.eqz
          i32.or
          local.tee 11
          br_if 0 (;@3;)
          local.get 7
          local.set 12
          local.get 6
          local.set 13
          block  ;; label = @4
            loop  ;; label = @5
              local.get 13
              i32.load
              local.get 5
              i32.eq
              br_if 1 (;@4;)
              local.get 13
              i32.const 4
              i32.add
              local.set 13
              local.get 12
              i32.const -1
              i32.add
              local.tee 12
              i32.eqz
              br_if 2 (;@3;)
              br 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 10
            local.get 5
            i32.eq
            br_if 0 (;@4;)
            local.get 3
            local.set 14
            loop  ;; label = @5
              local.get 9
              local.get 10
              i32.store offset=100
              local.get 0
              local.get 14
              local.get 6
              local.get 7
              local.get 9
              i32.const 100
              i32.add
              local.get 9
              i32.const 104
              i32.add
              call $_get_prev_page_serial
              local.set 14
              local.get 9
              i32.load offset=100
              local.get 10
              i32.ne
              br_if 0 (;@5;)
            end
          end
          local.get 0
          local.get 8
          i32.const 1
          i32.add
          local.tee 10
          i32.store offset=52
          block  ;; label = @4
            local.get 0
            i32.load offset=56
            local.tee 13
            i32.eqz
            br_if 0 (;@4;)
            local.get 13
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=64
            local.tee 13
            i32.eqz
            br_if 0 (;@4;)
            local.get 13
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=60
            local.tee 13
            i32.eqz
            br_if 0 (;@4;)
            local.get 13
            call $free
          end
          local.get 0
          local.get 0
          i32.load offset=52
          local.tee 13
          i32.const 3
          i32.shl
          i32.const 8
          i32.add
          call $malloc
          i32.store offset=56
          local.get 0
          local.get 0
          i32.load offset=72
          local.get 13
          i32.const 5
          i32.shl
          call $realloc
          i32.store offset=72
          local.get 0
          local.get 0
          i32.load offset=76
          local.get 0
          i32.load offset=52
          i32.const 4
          i32.shl
          call $realloc
          i32.store offset=76
          local.get 0
          local.get 0
          i32.load offset=52
          local.tee 13
          i32.const 2
          i32.shl
          call $malloc
          i32.store offset=64
          local.get 0
          local.get 13
          i32.const 3
          i32.shl
          call $malloc
          i32.store offset=60
          local.get 13
          i32.const 4
          i32.shl
          call $malloc
          local.set 13
          local.get 0
          i32.load offset=56
          local.tee 12
          local.get 10
          i32.const 3
          i32.shl
          i32.add
          local.get 3
          i64.store
          local.get 12
          local.get 8
          i32.const 3
          i32.shl
          i32.add
          local.get 1
          i64.store
          local.get 0
          local.get 13
          i32.store offset=68
          local.get 13
          local.get 8
          i32.const 4
          i32.shl
          i32.add
          i32.const 8
          i32.add
          local.get 9
          i64.load offset=104
          local.tee 14
          i64.const 0
          local.get 14
          i64.const 0
          i64.gt_s
          select
          i64.store
          br 1 (;@2;)
        end
        local.get 9
        i32.const 0
        i32.store offset=68
        local.get 9
        i32.const 0
        i32.store offset=64
        local.get 3
        local.set 15
        block  ;; label = @3
          local.get 2
          local.get 3
          i64.ge_s
          br_if 0 (;@3;)
          local.get 0
          i32.const 32
          i32.add
          local.tee 16
          i32.const 16
          i32.add
          local.set 17
          local.get 16
          i32.const 8
          i32.add
          local.set 18
          local.get 3
          local.set 15
          local.get 3
          local.set 1
          loop  ;; label = @4
            local.get 2
            local.set 14
            block  ;; label = @5
              local.get 1
              local.get 2
              i64.sub
              i64.const 65535
              i64.lt_s
              br_if 0 (;@5;)
              local.get 1
              local.get 2
              i64.add
              i64.const 2
              i64.div_s
              local.set 14
            end
            block  ;; label = @5
              local.get 0
              i32.load
              local.tee 13
              br_if 0 (;@5;)
              i32.const -129
              local.set 12
              br 4 (;@1;)
            end
            block  ;; label = @5
              local.get 0
              i64.load offset=8
              local.get 14
              i64.eq
              br_if 0 (;@5;)
              i32.const -128
              local.set 12
              local.get 0
              i32.load offset=652
              local.tee 19
              i32.eqz
              br_if 4 (;@1;)
              local.get 13
              local.get 14
              i32.const 0
              local.get 19
              call_indirect (type 0)
              i32.const -1
              i32.eq
              br_if 4 (;@1;)
              local.get 0
              local.get 14
              i64.store offset=8
              local.get 0
              i32.load offset=28
              i32.const 0
              i32.lt_s
              br_if 0 (;@5;)
              local.get 16
              i64.const 0
              i64.store align=4
              local.get 17
              i32.const 0
              i32.store
              local.get 18
              i64.const 0
              i64.store align=4
            end
            block  ;; label = @5
              local.get 0
              local.get 9
              i32.const 72
              i32.add
              i64.const -1
              call $_get_next_page
              local.tee 20
              i64.const -128
              i64.ne
              br_if 0 (;@5;)
              i32.const -128
              local.set 12
              br 4 (;@1;)
            end
            block  ;; label = @5
              block  ;; label = @6
                local.get 20
                i64.const 0
                i64.ge_s
                br_if 0 (;@6;)
                local.get 14
                local.set 1
                br 1 (;@5;)
              end
              block  ;; label = @6
                local.get 11
                br_if 0 (;@6;)
                local.get 9
                i32.load offset=72
                i32.const 14
                i32.add
                i32.load align=1
                local.set 19
                local.get 7
                local.set 12
                local.get 6
                local.set 13
                block  ;; label = @7
                  loop  ;; label = @8
                    local.get 13
                    i32.load
                    local.get 19
                    i32.eq
                    br_if 1 (;@7;)
                    local.get 13
                    i32.const 4
                    i32.add
                    local.set 13
                    local.get 12
                    i32.const -1
                    i32.add
                    local.tee 12
                    i32.eqz
                    br_if 2 (;@6;)
                    br 0 (;@8;)
                  end
                end
                local.get 0
                i64.load offset=8
                local.set 2
                br 1 (;@5;)
              end
              local.get 14
              local.set 1
              local.get 20
              local.set 15
            end
            local.get 2
            local.get 1
            i64.lt_s
            br_if 0 (;@4;)
          end
        end
        local.get 15
        local.set 14
        loop  ;; label = @3
          local.get 9
          local.get 10
          i32.store offset=12
          local.get 0
          local.get 14
          local.get 6
          local.get 7
          local.get 9
          i32.const 12
          i32.add
          local.get 9
          i32.const 88
          i32.add
          call $_get_prev_page_serial
          local.set 14
          local.get 9
          i32.load offset=12
          local.get 10
          i32.ne
          br_if 0 (;@3;)
        end
        block  ;; label = @3
          local.get 0
          i32.load
          local.tee 13
          br_if 0 (;@3;)
          i32.const -129
          local.set 12
          br 2 (;@1;)
        end
        block  ;; label = @3
          local.get 0
          i64.load offset=8
          local.get 15
          i64.eq
          br_if 0 (;@3;)
          i32.const -128
          local.set 12
          local.get 0
          i32.const 652
          i32.add
          i32.load
          local.tee 10
          i32.eqz
          br_if 2 (;@1;)
          local.get 13
          local.get 15
          i32.const 0
          local.get 10
          call_indirect (type 0)
          i32.const -1
          i32.eq
          br_if 2 (;@1;)
          local.get 0
          local.get 15
          i64.store offset=8
          local.get 0
          i32.const 28
          i32.add
          i32.load
          i32.const 0
          i32.lt_s
          br_if 0 (;@3;)
          local.get 0
          i32.const 48
          i32.add
          i32.const 0
          i32.store
          local.get 0
          i32.const 40
          i32.add
          i64.const 0
          i64.store align=4
          local.get 0
          i32.const 32
          i32.add
          i64.const 0
          i64.store align=4
        end
        local.get 0
        local.get 9
        i32.const 32
        i32.add
        local.get 9
        i32.const 16
        i32.add
        local.get 9
        i32.const 68
        i32.add
        local.get 9
        i32.const 64
        i32.add
        i32.const 0
        call $_fetch_headers
        local.tee 12
        br_if 1 (;@1;)
        local.get 0
        i64.load offset=8
        local.set 2
        local.get 0
        i32.load offset=456
        local.set 10
        local.get 0
        local.get 9
        i32.const 32
        i32.add
        call $_initial_pcmoffset
        local.set 14
        local.get 0
        local.get 15
        local.get 0
        i64.load offset=8
        local.get 3
        local.get 4
        local.get 5
        local.get 9
        i32.load offset=68
        local.get 9
        i32.load offset=64
        local.get 8
        i32.const 1
        i32.add
        local.tee 13
        call $_bisect_forward_serialno
        local.tee 12
        br_if 1 (;@1;)
        block  ;; label = @3
          local.get 9
          i32.load offset=68
          local.tee 12
          i32.eqz
          br_if 0 (;@3;)
          local.get 12
          call $free
        end
        local.get 0
        i32.load offset=56
        local.get 13
        i32.const 3
        i32.shl
        local.tee 12
        i32.add
        local.get 15
        i64.store
        local.get 0
        i32.load offset=60
        local.get 12
        i32.add
        local.get 2
        i64.store
        local.get 0
        i32.load offset=64
        local.get 13
        i32.const 2
        i32.shl
        i32.add
        local.get 10
        i32.store
        local.get 0
        i32.load offset=72
        local.get 13
        i32.const 5
        i32.shl
        i32.add
        local.tee 10
        i32.const 16
        i32.add
        local.get 9
        i32.const 32
        i32.add
        i32.const 16
        i32.add
        i64.load align=4
        i64.store align=4
        local.get 10
        i32.const 8
        i32.add
        local.get 9
        i32.const 32
        i32.add
        i32.const 8
        i32.add
        i64.load align=4
        i64.store align=4
        local.get 10
        local.get 9
        i64.load offset=32 align=4
        i64.store align=4
        local.get 10
        i32.const 24
        i32.add
        local.get 9
        i32.const 32
        i32.add
        i32.const 24
        i32.add
        i64.load align=4
        i64.store align=4
        local.get 0
        i32.load offset=76
        local.get 13
        i32.const 4
        i32.shl
        i32.add
        local.tee 13
        local.get 9
        i64.load offset=16 align=4
        i64.store align=4
        local.get 13
        i32.const 8
        i32.add
        local.get 9
        i32.const 16
        i32.add
        i32.const 8
        i32.add
        i64.load align=4
        i64.store align=4
        local.get 0
        i32.load offset=68
        local.get 8
        i32.const 4
        i32.shl
        i32.add
        local.tee 13
        i32.const 8
        i32.add
        local.get 9
        i64.load offset=88
        i64.store
        local.get 13
        i32.const 16
        i32.add
        local.get 14
        i64.store
        local.get 13
        i32.const 24
        i32.add
        local.tee 13
        local.get 13
        i64.load
        local.get 14
        i64.sub
        local.tee 14
        i64.const 0
        local.get 14
        i64.const 0
        i64.gt_s
        select
        i64.store
      end
      i32.const 0
      local.set 12
    end
    local.get 9
    i32.const 112
    i32.add
    global.set $__stack_pointer
    local.get 12)
  (func $vorbis_dsp_clear (type 4) (param i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.load offset=4
          local.tee 1
          br_if 0 (;@3;)
          i32.const 0
          local.set 2
          br 1 (;@2;)
        end
        local.get 1
        i32.load offset=28
        local.set 2
      end
      local.get 0
      i32.load offset=72
      local.set 3
      block  ;; label = @2
        local.get 0
        i32.load offset=8
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 1
          i32.load offset=4
          local.tee 5
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 4
          i32.const 0
          local.set 6
          loop  ;; label = @4
            block  ;; label = @5
              local.get 0
              i32.load offset=8
              local.get 4
              i32.add
              i32.load
              local.tee 7
              i32.eqz
              br_if 0 (;@5;)
              local.get 7
              call $free
              local.get 1
              i32.load offset=4
              local.set 5
            end
            local.get 4
            i32.const 4
            i32.add
            local.set 4
            local.get 6
            i32.const 1
            i32.add
            local.tee 6
            local.get 5
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 0
          i32.load offset=8
          local.set 4
        end
        local.get 4
        call $free
        local.get 0
        i32.load offset=12
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        call $free
      end
      block  ;; label = @2
        local.get 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        i32.load offset=8
        local.tee 5
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 4
        i32.const 0
        local.set 6
        loop  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 3
            i32.load offset=12
            local.tee 7
            i32.eqz
            br_if 0 (;@4;)
            local.get 7
            local.get 4
            i32.add
            i32.load
            call $mapping0_free_look
            local.get 2
            i32.load offset=8
            local.set 5
          end
          local.get 4
          i32.const 4
          i32.add
          local.set 4
          local.get 6
          i32.const 1
          i32.add
          local.tee 6
          local.get 5
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 3
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 3
          i32.load offset=12
          local.tee 4
          i32.eqz
          br_if 0 (;@3;)
          local.get 4
          call $free
        end
        local.get 3
        call $free
      end
      local.get 0
      i32.const 0
      i32.const 80
      call $memset
      drop
    end)
  (func $vorbis_block_clear (type 4) (param i32)
    (local i32 i32)
    block  ;; label = @1
      local.get 0
      i32.load offset=84
      local.tee 1
      i32.eqz
      br_if 0 (;@1;)
      loop  ;; label = @2
        local.get 1
        i32.load offset=4
        local.set 2
        local.get 1
        i32.load
        call $free
        local.get 1
        call $free
        local.get 2
        local.set 1
        local.get 2
        br_if 0 (;@2;)
      end
    end
    local.get 0
    i32.load offset=68
    local.set 1
    block  ;; label = @1
      local.get 0
      i32.load offset=80
      local.tee 2
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      local.get 0
      i32.load offset=76
      local.get 2
      i32.add
      call $realloc
      local.tee 1
      i32.store offset=68
      local.get 0
      i32.load offset=80
      local.set 2
      local.get 0
      i32.const 0
      i32.store offset=80
      local.get 0
      local.get 2
      local.get 0
      i32.load offset=76
      i32.add
      i32.store offset=76
    end
    local.get 0
    i32.const 0
    i32.store offset=84
    local.get 0
    i32.const 0
    i32.store offset=72
    block  ;; label = @1
      local.get 1
      i32.eqz
      br_if 0 (;@1;)
      local.get 1
      call $free
    end
    local.get 0
    i32.const 0
    i32.const 88
    call $memset
    drop)
  (func $vorbis_packet_blocksize (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32)
    i32.const -135
    local.set 3
    block  ;; label = @1
      local.get 2
      i32.const 2147483644
      i32.add
      i32.const 2147483645
      i32.lt_u
      br_if 0 (;@1;)
      local.get 1
      i32.load8_u
      i32.const 1
      i32.and
      br_if 0 (;@1;)
      i32.const 0
      local.set 4
      block  ;; label = @2
        local.get 0
        i32.load offset=8
        local.tee 3
        i32.const 2
        i32.lt_s
        br_if 0 (;@2;)
        i32.const -1
        local.set 4
        loop  ;; label = @3
          local.get 4
          local.tee 5
          i32.const 1
          i32.add
          local.set 4
          local.get 3
          i32.const 3
          i32.gt_u
          local.set 6
          local.get 3
          i32.const 1
          i32.shr_u
          local.set 3
          local.get 6
          br_if 0 (;@3;)
        end
        i32.const -136
        local.set 3
        local.get 4
        i32.const 31
        i32.gt_u
        br_if 1 (;@1;)
        local.get 5
        i32.const 2
        i32.add
        local.set 4
      end
      local.get 4
      i32.const 2
      i32.shl
      i32.const 16798208
      i32.add
      i32.load
      local.set 5
      block  ;; label = @2
        local.get 2
        i32.const -4
        i32.add
        i32.const 0
        i32.gt_s
        br_if 0 (;@2;)
        local.get 2
        local.get 4
        i32.const 8
        i32.add
        i32.const 3
        i32.shr_s
        i32.sub
        i32.const 0
        i32.ge_s
        br_if 0 (;@2;)
        i32.const -136
        return
      end
      local.get 1
      i32.load8_u
      i32.const 1
      i32.shr_u
      local.set 6
      block  ;; label = @2
        local.get 4
        i32.const 1
        i32.add
        local.tee 3
        i32.const 9
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 1
        i32.add
        i32.load8_u
        i32.const 7
        i32.shl
        local.get 6
        i32.or
        local.set 6
        local.get 3
        i32.const 17
        i32.lt_u
        br_if 0 (;@2;)
        local.get 1
        i32.const 2
        i32.add
        i32.load8_u
        i32.const 15
        i32.shl
        local.get 6
        i32.or
        local.set 6
        local.get 3
        i32.const 25
        i32.lt_u
        br_if 0 (;@2;)
        local.get 1
        i32.const 3
        i32.add
        i32.load8_u
        i32.const 23
        i32.shl
        local.get 6
        i32.or
        local.set 6
        local.get 3
        i32.const 33
        i32.lt_u
        br_if 0 (;@2;)
        local.get 1
        i32.const 4
        i32.add
        i32.load8_u
        i32.const 31
        i32.shl
        local.get 6
        i32.or
        local.set 6
      end
      i32.const -136
      local.set 3
      local.get 6
      local.get 5
      i32.and
      local.tee 4
      i32.const -1
      i32.eq
      br_if 0 (;@1;)
      local.get 0
      local.get 4
      i32.const 2
      i32.shl
      i32.add
      i32.const 32
      i32.add
      i32.load
      local.tee 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      local.get 4
      i32.load
      i32.const 2
      i32.shl
      i32.add
      i32.load
      local.set 3
    end
    local.get 3)
  (func $ogg_stream_packetout (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    i32.const 0
    local.set 2
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.load
      local.tee 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=32
      local.get 0
      i32.load offset=36
      local.tee 4
      i32.le_s
      br_if 0 (;@1;)
      i32.const -1
      local.set 2
      block  ;; label = @2
        local.get 0
        i32.load offset=16
        local.tee 5
        local.get 4
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.tee 6
        i32.const 1024
        i32.and
        br_if 0 (;@2;)
        local.get 6
        i32.const 512
        i32.and
        local.set 7
        block  ;; label = @3
          local.get 6
          i32.const 255
          i32.and
          local.tee 8
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 4
          i32.const 2
          i32.shl
          local.get 5
          i32.add
          i32.const 4
          i32.add
          local.set 2
          i32.const 255
          local.set 8
          loop  ;; label = @4
            i32.const 512
            local.get 7
            local.get 2
            i32.load
            local.tee 5
            i32.const 512
            i32.and
            select
            local.set 7
            local.get 2
            i32.const 4
            i32.add
            local.set 2
            local.get 4
            i32.const 1
            i32.add
            local.set 4
            local.get 5
            i32.const 255
            i32.and
            local.tee 5
            local.get 8
            i32.add
            local.set 8
            local.get 5
            i32.const 255
            i32.eq
            br_if 0 (;@4;)
          end
        end
        block  ;; label = @3
          block  ;; label = @4
            local.get 1
            br_if 0 (;@4;)
            local.get 0
            i32.load offset=12
            local.set 2
            br 1 (;@3;)
          end
          local.get 1
          local.get 0
          i64.load offset=344
          i64.store offset=24
          local.get 1
          local.get 6
          i32.const 256
          i32.and
          i32.store offset=8
          local.get 1
          local.get 7
          i32.store offset=12
          local.get 1
          local.get 8
          i32.store offset=4
          local.get 1
          local.get 3
          local.get 0
          i32.load offset=12
          local.tee 2
          i32.add
          i32.store
          local.get 1
          local.get 0
          i32.load offset=20
          local.get 4
          i32.const 3
          i32.shl
          i32.add
          i64.load
          i64.store offset=16
        end
        local.get 0
        local.get 2
        local.get 8
        i32.add
        i32.store offset=12
        i32.const 1
        local.set 2
      end
      local.get 0
      local.get 4
      i32.const 1
      i32.add
      i32.store offset=36
      local.get 0
      local.get 0
      i64.load offset=344
      i64.const 1
      i64.add
      i64.store offset=344
    end
    local.get 2)
  (func $_get_next_page (type 13) (param i32 i32 i64) (result i64)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i64)
    block  ;; label = @1
      local.get 2
      i64.const 1
      i64.lt_s
      br_if 0 (;@1;)
      local.get 0
      i64.load offset=8
      local.get 2
      i64.add
      local.set 2
    end
    local.get 0
    i32.const 24
    i32.add
    local.set 3
    block  ;; label = @1
      loop  ;; label = @2
        block  ;; label = @3
          local.get 2
          i64.const 1
          i64.lt_s
          br_if 0 (;@3;)
          local.get 0
          i64.load offset=8
          local.get 2
          i64.lt_s
          br_if 0 (;@3;)
          i64.const -1
          return
        end
        block  ;; label = @3
          block  ;; label = @4
            local.get 0
            i32.load offset=28
            i32.const 0
            i32.lt_s
            br_if 0 (;@4;)
            local.get 0
            i32.load offset=32
            local.get 0
            i32.load offset=36
            local.tee 4
            i32.sub
            local.set 5
            local.get 0
            i32.load offset=24
            local.tee 6
            local.get 4
            i32.add
            local.set 7
            block  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        block  ;; label = @11
                          block  ;; label = @12
                            block  ;; label = @13
                              local.get 0
                              i32.load offset=44
                              local.tee 8
                              br_if 0 (;@13;)
                              local.get 5
                              i32.const 27
                              i32.lt_s
                              br_if 9 (;@4;)
                              i32.const -79
                              local.set 9
                              block  ;; label = @14
                                block  ;; label = @15
                                  local.get 7
                                  i32.load8_u
                                  local.tee 4
                                  i32.const 79
                                  i32.ne
                                  br_if 0 (;@15;)
                                  i32.const -103
                                  local.set 9
                                  local.get 7
                                  i32.load8_u offset=1
                                  local.tee 4
                                  i32.const 103
                                  i32.ne
                                  br_if 0 (;@15;)
                                  local.get 7
                                  i32.load8_u offset=2
                                  local.tee 4
                                  i32.const 103
                                  i32.ne
                                  br_if 0 (;@15;)
                                  i32.const -83
                                  local.set 9
                                  local.get 7
                                  i32.load8_u offset=3
                                  local.tee 4
                                  i32.const 83
                                  i32.eq
                                  br_if 1 (;@14;)
                                end
                                local.get 9
                                i32.const 0
                                local.get 4
                                i32.sub
                                i32.ne
                                br_if 2 (;@12;)
                              end
                              local.get 5
                              local.get 7
                              i32.const 26
                              i32.add
                              local.tee 6
                              i32.load8_u
                              local.tee 4
                              i32.const 27
                              i32.add
                              local.tee 8
                              i32.lt_u
                              br_if 9 (;@4;)
                              block  ;; label = @14
                                local.get 4
                                i32.eqz
                                br_if 0 (;@14;)
                                local.get 7
                                i32.const 27
                                i32.add
                                local.set 10
                                local.get 0
                                i32.load offset=48
                                local.set 9
                                i32.const 0
                                local.set 4
                                loop  ;; label = @15
                                  local.get 0
                                  local.get 9
                                  local.get 10
                                  local.get 4
                                  i32.add
                                  i32.load8_u
                                  i32.add
                                  local.tee 9
                                  i32.store offset=48
                                  local.get 4
                                  i32.const 1
                                  i32.add
                                  local.tee 4
                                  local.get 6
                                  i32.load8_u
                                  i32.lt_u
                                  br_if 0 (;@15;)
                                end
                              end
                              local.get 0
                              local.get 8
                              i32.store offset=44
                            end
                            local.get 8
                            local.get 0
                            i32.load offset=48
                            i32.add
                            local.get 5
                            i32.gt_s
                            br_if 8 (;@4;)
                            local.get 7
                            i32.const 22
                            i32.add
                            local.tee 8
                            i32.load align=1
                            local.set 4
                            local.get 8
                            i32.const 0
                            i32.store align=1
                            local.get 8
                            i32.const 0
                            local.get 7
                            local.get 0
                            i32.load offset=44
                            local.tee 9
                            call $_os_update_crc
                            local.get 7
                            local.get 9
                            i32.add
                            local.get 0
                            i32.load offset=48
                            call $_os_update_crc
                            local.tee 9
                            i32.store align=1
                            local.get 4
                            local.set 6
                            block  ;; label = @13
                              local.get 9
                              i32.const 255
                              i32.and
                              local.get 4
                              i32.const 255
                              i32.and
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 7
                              i32.const 23
                              i32.add
                              i32.load8_u
                              local.tee 9
                              local.get 4
                              i32.const 8
                              i32.shr_u
                              local.tee 6
                              i32.const 255
                              i32.and
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 7
                              i32.const 24
                              i32.add
                              i32.load8_u
                              local.tee 9
                              local.get 4
                              i32.const 16
                              i32.shr_u
                              local.tee 6
                              i32.const 255
                              i32.and
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 7
                              i32.const 25
                              i32.add
                              i32.load8_u
                              local.tee 9
                              local.get 4
                              i32.const 24
                              i32.shr_u
                              local.tee 6
                              i32.eq
                              br_if 2 (;@11;)
                            end
                            local.get 9
                            i32.const 255
                            i32.and
                            local.get 6
                            i32.const 255
                            i32.and
                            i32.eq
                            br_if 1 (;@11;)
                            local.get 8
                            local.get 4
                            i32.store align=1
                            local.get 3
                            i32.load
                            local.set 6
                          end
                          local.get 0
                          i64.const 0
                          i64.store offset=44 align=4
                          local.get 5
                          i32.const -1
                          i32.add
                          local.tee 9
                          i32.const 0
                          i32.ne
                          local.set 8
                          local.get 7
                          i32.const 1
                          i32.add
                          local.tee 4
                          i32.const 3
                          i32.and
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 9
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 4
                          i32.load8_u
                          i32.const 79
                          i32.eq
                          br_if 3 (;@8;)
                          local.get 5
                          i32.const -2
                          i32.add
                          local.tee 9
                          i32.const 0
                          i32.ne
                          local.set 8
                          local.get 7
                          i32.const 2
                          i32.add
                          local.tee 4
                          i32.const 3
                          i32.and
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 9
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 4
                          i32.load8_u
                          i32.const 79
                          i32.eq
                          br_if 3 (;@8;)
                          local.get 5
                          i32.const -3
                          i32.add
                          local.tee 9
                          i32.const 0
                          i32.ne
                          local.set 8
                          local.get 7
                          i32.const 3
                          i32.add
                          local.tee 4
                          i32.const 3
                          i32.and
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 9
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 4
                          i32.load8_u
                          i32.const 79
                          i32.eq
                          br_if 3 (;@8;)
                          local.get 5
                          i32.const -4
                          i32.add
                          local.tee 9
                          i32.const 0
                          i32.ne
                          local.set 8
                          local.get 7
                          i32.const 4
                          i32.add
                          local.tee 4
                          i32.const 3
                          i32.and
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 9
                          i32.eqz
                          br_if 1 (;@10;)
                          local.get 4
                          i32.load8_u
                          i32.const 79
                          i32.eq
                          br_if 3 (;@8;)
                          local.get 5
                          i32.const -5
                          i32.add
                          local.tee 9
                          i32.eqz
                          br_if 4 (;@7;)
                          local.get 7
                          i32.const 5
                          i32.add
                          local.set 4
                          br 2 (;@9;)
                        end
                        local.get 0
                        i32.load offset=48
                        local.set 9
                        local.get 0
                        i32.load offset=44
                        local.set 4
                        block  ;; label = @11
                          local.get 1
                          i32.eqz
                          br_if 0 (;@11;)
                          local.get 1
                          local.get 9
                          i32.store offset=12
                          local.get 1
                          local.get 4
                          i32.store offset=4
                          local.get 1
                          local.get 7
                          i32.store
                          local.get 1
                          local.get 7
                          local.get 4
                          i32.add
                          i32.store offset=8
                        end
                        local.get 0
                        i64.const 0
                        i64.store offset=40 align=4
                        local.get 0
                        i32.const 0
                        i32.store offset=48
                        local.get 0
                        local.get 0
                        i32.load offset=36
                        local.get 9
                        local.get 4
                        i32.add
                        local.tee 4
                        i32.add
                        i32.store offset=36
                        br 5 (;@5;)
                      end
                      local.get 8
                      i32.eqz
                      br_if 2 (;@7;)
                    end
                    block  ;; label = @9
                      local.get 4
                      i32.load8_u
                      i32.const 79
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 9
                      i32.const 4
                      i32.lt_u
                      br_if 0 (;@9;)
                      loop  ;; label = @10
                        local.get 4
                        i32.load
                        local.tee 5
                        i32.const -1
                        i32.xor
                        local.get 5
                        i32.const 1330597711
                        i32.xor
                        i32.const -16843009
                        i32.add
                        i32.and
                        i32.const -2139062144
                        i32.and
                        br_if 2 (;@8;)
                        local.get 4
                        i32.const 4
                        i32.add
                        local.set 4
                        local.get 9
                        i32.const -4
                        i32.add
                        local.tee 9
                        i32.const 3
                        i32.gt_u
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 9
                    i32.eqz
                    br_if 1 (;@7;)
                  end
                  loop  ;; label = @8
                    local.get 4
                    i32.load8_u
                    i32.const 79
                    i32.eq
                    br_if 2 (;@6;)
                    local.get 4
                    i32.const 1
                    i32.add
                    local.set 4
                    local.get 9
                    i32.const -1
                    i32.add
                    local.tee 9
                    br_if 0 (;@8;)
                  end
                end
                local.get 6
                local.get 0
                i32.load offset=32
                i32.add
                local.set 4
              end
              local.get 0
              local.get 4
              local.get 6
              i32.sub
              i32.store offset=36
              local.get 7
              local.get 4
              i32.sub
              local.set 4
            end
            block  ;; label = @5
              local.get 4
              i32.const -1
              i32.gt_s
              br_if 0 (;@5;)
              local.get 0
              local.get 0
              i64.load offset=8
              local.get 4
              i64.extend_i32_s
              i64.sub
              i64.store offset=8
              br 3 (;@2;)
            end
            local.get 4
            br_if 1 (;@3;)
          end
          block  ;; label = @4
            local.get 2
            i64.eqz
            i32.eqz
            br_if 0 (;@4;)
            i64.const -1
            return
          end
          i32.const 16799520
          i32.const 0
          i32.store
          i64.const -128
          local.set 11
          local.get 0
          i32.load offset=648
          i32.eqz
          br_if 2 (;@1;)
          block  ;; label = @4
            block  ;; label = @5
              local.get 0
              i32.load
              i32.eqz
              br_if 0 (;@5;)
              i32.const 0
              local.set 4
              block  ;; label = @6
                local.get 0
                i32.load offset=28
                local.tee 9
                i32.const 0
                i32.lt_s
                br_if 0 (;@6;)
                local.get 0
                i32.load offset=32
                local.set 4
                block  ;; label = @7
                  local.get 0
                  i32.load offset=36
                  local.tee 7
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 0
                  local.get 4
                  local.get 7
                  i32.sub
                  local.tee 4
                  i32.store offset=32
                  block  ;; label = @8
                    local.get 4
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 0
                    i32.load offset=24
                    local.tee 9
                    local.get 9
                    local.get 7
                    i32.add
                    local.get 4
                    call $memmove
                    drop
                    local.get 0
                    i32.load offset=32
                    local.set 4
                    local.get 0
                    i32.load offset=28
                    local.set 9
                  end
                  local.get 0
                  i32.const 0
                  i32.store offset=36
                end
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 9
                    local.get 4
                    i32.sub
                    i32.const 1024
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 3
                    i32.load
                    local.set 9
                    br 1 (;@7;)
                  end
                  block  ;; label = @8
                    local.get 4
                    i32.const -2147479552
                    i32.add
                    i32.const -1024
                    i32.lt_s
                    br_if 0 (;@8;)
                    block  ;; label = @9
                      local.get 3
                      i32.load
                      local.tee 4
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 4
                      call $free
                    end
                    local.get 3
                    i64.const 0
                    i64.store align=4
                    i32.const 0
                    local.set 4
                    local.get 3
                    i32.const 24
                    i32.add
                    i32.const 0
                    i32.store
                    local.get 3
                    i32.const 16
                    i32.add
                    i64.const 0
                    i64.store align=4
                    local.get 3
                    i32.const 8
                    i32.add
                    i64.const 0
                    i64.store align=4
                    br 2 (;@6;)
                  end
                  local.get 4
                  i32.const 5120
                  i32.add
                  local.set 4
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 3
                      i32.load
                      local.tee 9
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 9
                      local.get 4
                      call $realloc
                      local.set 9
                      br 1 (;@8;)
                    end
                    local.get 4
                    call $malloc
                    local.set 9
                  end
                  block  ;; label = @8
                    local.get 9
                    br_if 0 (;@8;)
                    block  ;; label = @9
                      local.get 3
                      i32.load
                      local.tee 4
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 4
                      call $free
                    end
                    local.get 3
                    i64.const 0
                    i64.store align=4
                    i32.const 0
                    local.set 4
                    local.get 3
                    i32.const 24
                    i32.add
                    i32.const 0
                    i32.store
                    local.get 3
                    i32.const 16
                    i32.add
                    i64.const 0
                    i64.store align=4
                    local.get 3
                    i32.const 8
                    i32.add
                    i64.const 0
                    i64.store align=4
                    br 2 (;@6;)
                  end
                  local.get 0
                  local.get 4
                  i32.store offset=28
                  local.get 0
                  local.get 9
                  i32.store offset=24
                  local.get 0
                  i32.load offset=32
                  local.set 4
                end
                local.get 9
                local.get 4
                i32.add
                local.set 4
              end
              local.get 4
              i32.const 1
              i32.const 1024
              local.get 0
              i32.load
              local.get 0
              i32.load offset=648
              call_indirect (type 2)
              local.tee 4
              i32.const 0
              i32.gt_s
              br_if 1 (;@4;)
              local.get 4
              br_if 4 (;@1;)
              i32.const 16799520
              i32.load
              br_if 4 (;@1;)
            end
            i64.const -2
            return
          end
          local.get 0
          i32.load offset=28
          local.tee 9
          i32.const 0
          i32.lt_s
          br_if 1 (;@2;)
          local.get 0
          i32.load offset=32
          local.get 4
          i32.add
          local.tee 4
          local.get 9
          i32.gt_s
          br_if 1 (;@2;)
          local.get 0
          local.get 4
          i32.store offset=32
          br 1 (;@2;)
        end
      end
      local.get 0
      local.get 0
      i64.load offset=8
      local.tee 11
      local.get 4
      i64.extend_i32_u
      i64.add
      i64.store offset=8
    end
    local.get 11)
  (func $ov_pcm_total (type 10) (param i32 i32) (result i64)
    (local i64 i32)
    i64.const -131
    local.set 2
    block  ;; label = @1
      local.get 0
      i32.load offset=88
      i32.const 2
      i32.lt_s
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=4
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=52
      local.tee 3
      local.get 1
      i32.le_s
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 1
        i32.const -1
        i32.gt_s
        br_if 0 (;@2;)
        i64.const 0
        local.set 2
        local.get 3
        i32.const 1
        i32.lt_s
        br_if 1 (;@1;)
        i32.const 0
        local.set 1
        loop  ;; label = @3
          local.get 0
          local.get 1
          call $ov_pcm_total
          local.get 2
          i64.add
          local.set 2
          local.get 3
          local.get 1
          i32.const 1
          i32.add
          local.tee 1
          i32.ne
          br_if 0 (;@3;)
          br 2 (;@1;)
        end
      end
      local.get 0
      i32.load offset=68
      local.get 1
      i32.const 4
      i32.shl
      i32.add
      i32.const 8
      i32.add
      i64.load
      local.set 2
    end
    local.get 2)
  (func $ogg_stream_pagein (type 8) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i64 i32 i32 i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.load
      local.tee 2
      i32.eqz
      br_if 0 (;@1;)
      local.get 1
      i32.load
      local.tee 3
      i32.const 5
      i32.add
      i32.load8_u
      local.set 4
      local.get 3
      i32.const 26
      i32.add
      i32.load8_u
      local.set 5
      local.get 3
      i32.const 18
      i32.add
      i32.load align=1
      local.set 6
      local.get 3
      i32.const 14
      i32.add
      i32.load align=1
      local.set 7
      local.get 3
      i32.const 6
      i32.add
      i64.load align=1
      local.set 8
      local.get 3
      i32.const 4
      i32.add
      i32.load8_u
      local.set 9
      local.get 1
      i32.load offset=12
      local.set 10
      local.get 1
      i32.load offset=8
      local.set 11
      local.get 0
      i32.load offset=36
      local.set 1
      block  ;; label = @2
        local.get 0
        i32.load offset=12
        local.tee 12
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        local.get 0
        i32.load offset=8
        local.tee 13
        local.get 12
        i32.sub
        local.tee 14
        i32.store offset=8
        block  ;; label = @3
          local.get 13
          local.get 12
          i32.eq
          br_if 0 (;@3;)
          local.get 2
          local.get 2
          local.get 12
          i32.add
          local.get 14
          call $memmove
          drop
        end
        local.get 0
        i32.const 0
        i32.store offset=12
      end
      block  ;; label = @2
        local.get 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        local.set 12
        block  ;; label = @3
          local.get 0
          i32.load offset=28
          local.tee 2
          local.get 1
          i32.eq
          br_if 0 (;@3;)
          local.get 0
          i32.load offset=16
          local.tee 12
          local.get 12
          local.get 1
          i32.const 2
          i32.shl
          i32.add
          local.get 2
          local.get 1
          i32.sub
          i32.const 2
          i32.shl
          call $memmove
          drop
          local.get 0
          i32.load offset=20
          local.tee 12
          local.get 12
          local.get 1
          i32.const 3
          i32.shl
          i32.add
          local.get 0
          i32.load offset=28
          local.get 1
          i32.sub
          i32.const 3
          i32.shl
          call $memmove
          drop
          local.get 0
          i32.load offset=28
          local.set 12
        end
        local.get 0
        i32.const 0
        i32.store offset=36
        local.get 0
        local.get 12
        local.get 1
        i32.sub
        i32.store offset=28
        local.get 0
        local.get 0
        i32.load offset=32
        local.get 1
        i32.sub
        i32.store offset=32
      end
      local.get 7
      local.get 0
      i32.load offset=336
      i32.ne
      br_if 0 (;@1;)
      local.get 9
      i32.const 255
      i32.and
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 0
        i32.load offset=24
        local.tee 1
        local.get 5
        i32.const 1
        i32.add
        local.tee 12
        i32.sub
        local.get 0
        i32.load offset=28
        i32.gt_s
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 1
          i32.const 2147483646
          local.get 5
          i32.sub
          i32.le_s
          br_if 0 (;@3;)
          block  ;; label = @4
            local.get 0
            i32.load
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=16
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=20
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          local.get 0
          i32.const 0
          i32.const 360
          call $memset
          drop
          return
        end
        block  ;; label = @3
          local.get 0
          i32.load offset=16
          local.get 1
          local.get 12
          i32.add
          local.tee 1
          i32.const 32
          i32.add
          local.get 1
          local.get 1
          i32.const 2147483615
          i32.lt_s
          select
          local.tee 1
          i32.const 2
          i32.shl
          call $realloc
          local.tee 12
          br_if 0 (;@3;)
          block  ;; label = @4
            local.get 0
            i32.load
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=16
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=20
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          local.get 0
          i32.const 0
          i32.const 360
          call $memset
          drop
          return
        end
        local.get 0
        local.get 12
        i32.store offset=16
        block  ;; label = @3
          local.get 0
          i32.load offset=20
          local.get 1
          i32.const 3
          i32.shl
          call $realloc
          local.tee 12
          br_if 0 (;@3;)
          block  ;; label = @4
            local.get 0
            i32.load
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=16
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=20
            local.tee 1
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            call $free
          end
          local.get 0
          i32.const 0
          i32.const 360
          call $memset
          drop
          return
        end
        local.get 0
        local.get 1
        i32.store offset=24
        local.get 0
        local.get 12
        i32.store offset=20
      end
      local.get 4
      i32.const 1
      i32.and
      local.set 9
      block  ;; label = @2
        local.get 6
        local.get 0
        i32.load offset=340
        local.tee 13
        i32.eq
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 0
          i32.load offset=32
          local.tee 7
          local.get 0
          i32.load offset=28
          local.tee 14
          i32.ge_s
          br_if 0 (;@3;)
          local.get 0
          i32.load offset=8
          local.set 12
          local.get 0
          i32.load offset=16
          local.set 15
          block  ;; label = @4
            block  ;; label = @5
              local.get 14
              local.get 7
              i32.sub
              i32.const 3
              i32.and
              local.tee 16
              br_if 0 (;@5;)
              local.get 7
              local.set 1
              br 1 (;@4;)
            end
            local.get 15
            local.get 7
            i32.const 2
            i32.shl
            i32.add
            local.set 1
            local.get 16
            local.set 2
            loop  ;; label = @5
              local.get 12
              local.get 1
              i32.load8_u
              i32.sub
              local.set 12
              local.get 1
              i32.const 4
              i32.add
              local.set 1
              local.get 2
              i32.const -1
              i32.add
              local.tee 2
              br_if 0 (;@5;)
            end
            local.get 7
            local.get 16
            i32.add
            local.set 1
          end
          block  ;; label = @4
            local.get 7
            local.get 14
            i32.sub
            i32.const -4
            i32.gt_u
            br_if 0 (;@4;)
            local.get 14
            local.get 1
            i32.sub
            local.set 2
            local.get 15
            local.get 1
            i32.const 2
            i32.shl
            i32.add
            local.set 1
            loop  ;; label = @5
              local.get 12
              local.get 1
              i32.load8_u
              local.get 1
              i32.const 4
              i32.add
              i32.load8_u
              i32.add
              local.get 1
              i32.const 8
              i32.add
              i32.load8_u
              i32.add
              local.get 1
              i32.const 12
              i32.add
              i32.load8_u
              i32.add
              i32.sub
              local.set 12
              local.get 1
              i32.const 16
              i32.add
              local.set 1
              local.get 2
              i32.const -4
              i32.add
              local.tee 2
              br_if 0 (;@5;)
            end
          end
          local.get 0
          local.get 12
          i32.store offset=8
        end
        local.get 0
        local.get 7
        i32.store offset=28
        local.get 13
        i32.const -1
        i32.eq
        br_if 0 (;@2;)
        local.get 0
        local.get 7
        i32.const 1
        i32.add
        local.tee 1
        i32.store offset=28
        local.get 0
        local.get 1
        i32.store offset=32
        local.get 0
        i32.load offset=16
        local.get 7
        i32.const 2
        i32.shl
        i32.add
        i32.const 1024
        i32.store
      end
      local.get 4
      i32.const 2
      i32.and
      local.set 12
      i32.const 0
      local.set 1
      block  ;; label = @2
        local.get 9
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 0
          i32.load offset=28
          local.tee 2
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          local.get 0
          i32.load offset=16
          local.get 2
          i32.const 2
          i32.shl
          i32.add
          i32.const -4
          i32.add
          i32.load8_u
          i32.const 255
          i32.eq
          br_if 1 (;@2;)
        end
        block  ;; label = @3
          local.get 5
          br_if 0 (;@3;)
          i32.const 0
          local.set 12
          i32.const 0
          local.set 1
          br 1 (;@2;)
        end
        local.get 3
        i32.const 27
        i32.add
        local.set 2
        i32.const 0
        local.set 1
        block  ;; label = @3
          loop  ;; label = @4
            local.get 10
            local.get 2
            local.get 1
            i32.add
            i32.load8_u
            local.tee 12
            i32.sub
            local.set 10
            local.get 11
            local.get 12
            i32.add
            local.set 11
            local.get 12
            i32.const 255
            i32.ne
            br_if 1 (;@3;)
            local.get 5
            local.get 1
            i32.const 1
            i32.add
            local.tee 1
            i32.ne
            br_if 0 (;@4;)
          end
          i32.const 0
          local.set 12
          local.get 5
          local.set 1
          br 1 (;@2;)
        end
        local.get 1
        i32.const 1
        i32.add
        local.set 1
        i32.const 0
        local.set 12
      end
      block  ;; label = @2
        local.get 10
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          block  ;; label = @4
            local.get 0
            i32.load offset=4
            local.tee 7
            local.get 10
            i32.sub
            local.get 0
            i32.load offset=8
            local.tee 2
            i32.le_s
            br_if 0 (;@4;)
            local.get 0
            i32.load
            local.set 7
            br 1 (;@3;)
          end
          block  ;; label = @4
            local.get 7
            local.get 10
            i32.const 2147483647
            i32.xor
            i32.le_s
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 0
              i32.load
              local.tee 1
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              call $free
            end
            block  ;; label = @5
              local.get 0
              i32.load offset=16
              local.tee 1
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              call $free
            end
            block  ;; label = @5
              local.get 0
              i32.load offset=20
              local.tee 1
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              call $free
            end
            local.get 0
            i32.const 0
            i32.const 360
            call $memset
            drop
            return
          end
          block  ;; label = @4
            local.get 0
            i32.load
            local.get 7
            local.get 10
            i32.add
            local.tee 2
            i32.const 1024
            i32.add
            local.get 2
            local.get 2
            i32.const 2147482623
            i32.lt_s
            select
            local.tee 2
            call $realloc
            local.tee 7
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 0
              i32.load
              local.tee 1
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              call $free
            end
            block  ;; label = @5
              local.get 0
              i32.load offset=16
              local.tee 1
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              call $free
            end
            block  ;; label = @5
              local.get 0
              i32.load offset=20
              local.tee 1
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              call $free
            end
            local.get 0
            i32.const 0
            i32.const 360
            call $memset
            drop
            return
          end
          local.get 0
          local.get 7
          i32.store
          local.get 0
          local.get 2
          i32.store offset=4
          local.get 0
          i32.load offset=8
          local.set 2
        end
        local.get 7
        local.get 2
        i32.add
        local.get 11
        local.get 10
        call $memcpy
        drop
        local.get 0
        local.get 0
        i32.load offset=8
        local.get 10
        i32.add
        i32.store offset=8
      end
      local.get 4
      i32.const 4
      i32.and
      local.set 14
      block  ;; label = @2
        local.get 1
        local.get 5
        i32.ge_s
        br_if 0 (;@2;)
        local.get 0
        i32.load offset=16
        local.tee 15
        local.get 0
        i32.load offset=28
        local.tee 10
        i32.const 2
        i32.shl
        i32.add
        local.tee 2
        local.get 3
        i32.const 27
        i32.add
        local.tee 4
        local.get 1
        i32.add
        i32.load8_u
        local.tee 11
        i32.store
        local.get 0
        i32.load offset=20
        local.tee 16
        local.get 10
        i32.const 3
        i32.shl
        i32.add
        i64.const -1
        i64.store
        block  ;; label = @3
          local.get 12
          i32.eqz
          br_if 0 (;@3;)
          local.get 2
          local.get 11
          i32.const 256
          i32.or
          i32.store
        end
        local.get 10
        i32.const 1
        i32.add
        local.set 12
        block  ;; label = @3
          block  ;; label = @4
            local.get 11
            i32.const 255
            i32.ne
            br_if 0 (;@4;)
            i32.const -1
            local.set 7
            br 1 (;@3;)
          end
          local.get 0
          local.get 12
          i32.store offset=32
          local.get 10
          local.set 7
        end
        local.get 0
        local.get 12
        i32.store offset=28
        block  ;; label = @3
          local.get 1
          i32.const 1
          i32.add
          local.tee 11
          local.get 5
          i32.eq
          br_if 0 (;@3;)
          local.get 5
          i32.const -2
          i32.add
          local.set 2
          block  ;; label = @4
            block  ;; label = @5
              local.get 1
              i32.const -1
              i32.xor
              local.get 5
              i32.add
              i32.const 1
              i32.and
              br_if 0 (;@5;)
              local.get 12
              local.set 4
              br 1 (;@4;)
            end
            local.get 4
            local.get 11
            i32.add
            i32.load8_u
            local.set 11
            local.get 16
            local.get 12
            i32.const 3
            i32.shl
            i32.add
            i64.const -1
            i64.store
            local.get 15
            local.get 12
            i32.const 2
            i32.shl
            i32.add
            local.get 11
            i32.store
            local.get 10
            i32.const 2
            i32.add
            local.set 4
            block  ;; label = @5
              local.get 11
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i32.store offset=32
              local.get 12
              local.set 7
            end
            local.get 0
            local.get 4
            i32.store offset=28
            local.get 1
            i32.const 2
            i32.add
            local.set 11
          end
          local.get 2
          local.get 1
          i32.eq
          br_if 0 (;@3;)
          local.get 3
          local.get 11
          i32.add
          local.set 9
          local.get 5
          local.get 11
          i32.sub
          local.set 13
          local.get 15
          local.get 4
          i32.const 2
          i32.shl
          i32.add
          local.set 1
          local.get 16
          local.get 4
          i32.const 3
          i32.shl
          i32.add
          local.set 3
          i32.const 0
          local.set 12
          loop  ;; label = @4
            local.get 9
            local.get 12
            i32.add
            local.tee 2
            i32.const 27
            i32.add
            i32.load8_u
            local.set 5
            local.get 3
            i64.const -1
            i64.store
            local.get 1
            local.get 5
            i32.store
            local.get 4
            local.get 12
            i32.add
            local.tee 11
            i32.const 1
            i32.add
            local.set 10
            block  ;; label = @5
              local.get 5
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 10
              i32.store offset=32
              local.get 11
              local.set 7
            end
            local.get 0
            local.get 10
            i32.store offset=28
            local.get 2
            i32.const 28
            i32.add
            i32.load8_u
            local.set 5
            local.get 3
            i32.const 8
            i32.add
            i64.const -1
            i64.store
            local.get 1
            i32.const 4
            i32.add
            local.get 5
            i32.store
            local.get 11
            i32.const 2
            i32.add
            local.set 11
            block  ;; label = @5
              local.get 5
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 11
              i32.store offset=32
              local.get 10
              local.set 7
            end
            local.get 0
            local.get 11
            i32.store offset=28
            local.get 1
            i32.const 8
            i32.add
            local.set 1
            local.get 3
            i32.const 16
            i32.add
            local.set 3
            local.get 13
            local.get 12
            i32.const 2
            i32.add
            local.tee 12
            i32.ne
            br_if 0 (;@4;)
          end
        end
        local.get 7
        i32.const -1
        i32.eq
        br_if 0 (;@2;)
        local.get 16
        local.get 7
        i32.const 3
        i32.shl
        i32.add
        local.get 8
        i64.store
      end
      block  ;; label = @2
        local.get 14
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        i32.const 1
        i32.store offset=328
        local.get 0
        i32.load offset=28
        local.tee 1
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 0
        i32.load offset=16
        local.get 1
        i32.const 2
        i32.shl
        i32.add
        i32.const -4
        i32.add
        local.tee 1
        local.get 1
        i32.load
        i32.const 512
        i32.or
        i32.store
      end
      local.get 0
      local.get 6
      i32.const 1
      i32.add
      i32.store offset=340
    end)
  (func $malloc (type 1) (param i32) (result i32)
    local.get 0
    call $emmalloc_memalign)
  (func $ov_read (type 2) (param i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i64 i64 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i64 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    i32.const -131
    local.set 5
    block  ;; label = @1
      local.get 0
      i32.load offset=88
      local.tee 6
      i32.const 2
      i32.lt_s
      br_if 0 (;@1;)
      local.get 0
      i32.const 564
      i32.add
      local.set 7
      local.get 0
      i32.const 464
      i32.add
      local.set 8
      local.get 0
      i32.const 120
      i32.add
      local.set 9
      local.get 0
      i32.const 104
      i32.add
      local.set 10
      local.get 0
      i32.const 560
      i32.add
      local.set 11
      local.get 0
      i32.const 480
      i32.add
      local.set 12
      loop  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              local.get 6
              i32.const 4
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              i32.load offset=504
              local.tee 13
              i32.const 0
              i32.lt_s
              br_if 0 (;@5;)
              local.get 0
              i32.load offset=500
              local.tee 14
              local.get 13
              i32.le_s
              br_if 0 (;@5;)
              block  ;; label = @6
                local.get 0
                i32.load offset=484
                i32.load offset=4
                local.tee 5
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                i32.const 0
                local.set 15
                block  ;; label = @7
                  local.get 5
                  i32.const 1
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 5
                  i32.const 1
                  i32.and
                  local.set 16
                  local.get 5
                  i32.const 2147483646
                  i32.and
                  local.set 17
                  i32.const 0
                  local.set 15
                  i32.const 4
                  local.set 5
                  loop  ;; label = @8
                    local.get 0
                    i32.load offset=492
                    local.get 5
                    i32.add
                    i32.const -4
                    i32.add
                    local.get 0
                    i32.load offset=488
                    local.get 5
                    i32.add
                    i32.const -4
                    i32.add
                    i32.load
                    local.get 13
                    i32.const 2
                    i32.shl
                    local.tee 18
                    i32.add
                    i32.store
                    local.get 0
                    i32.load offset=492
                    local.get 5
                    i32.add
                    local.get 0
                    i32.load offset=488
                    local.get 5
                    i32.add
                    i32.load
                    local.get 18
                    i32.add
                    i32.store
                    local.get 5
                    i32.const 8
                    i32.add
                    local.set 5
                    local.get 17
                    local.get 15
                    i32.const 2
                    i32.add
                    local.tee 15
                    i32.ne
                    br_if 0 (;@8;)
                  end
                  local.get 16
                  i32.eqz
                  br_if 1 (;@6;)
                end
                local.get 0
                i32.load offset=492
                local.get 15
                i32.const 2
                i32.shl
                local.tee 5
                i32.add
                local.get 0
                i32.load offset=488
                local.get 5
                i32.add
                i32.load
                local.get 13
                i32.const 2
                i32.shl
                i32.add
                i32.store
              end
              local.get 14
              local.get 13
              i32.sub
              local.tee 5
              br_if 1 (;@4;)
            end
            loop  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 6
                    i32.const -3
                    i32.add
                    br_table 0 (;@8;) 1 (;@7;) 2 (;@6;)
                  end
                  local.get 0
                  i32.load offset=72
                  local.set 5
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=4
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 12
                      local.get 5
                      local.get 0
                      i32.load offset=96
                      i32.const 5
                      i32.shl
                      i32.add
                      call $vorbis_synthesis_init
                      i32.eqz
                      br_if 1 (;@8;)
                      i32.const -137
                      local.set 5
                      br 6 (;@3;)
                    end
                    local.get 12
                    local.get 5
                    call $vorbis_synthesis_init
                    i32.eqz
                    br_if 0 (;@8;)
                    i32.const -137
                    local.set 5
                    br 5 (;@3;)
                  end
                  local.get 11
                  i32.const 0
                  i32.const 88
                  call $memset
                  drop
                  local.get 0
                  i32.const 4
                  i32.store offset=88
                  local.get 0
                  local.get 12
                  i32.store offset=624
                  local.get 10
                  i64.const 0
                  i64.store
                  local.get 10
                  i32.const 8
                  i32.add
                  i64.const 0
                  i64.store
                end
                block  ;; label = @7
                  loop  ;; label = @8
                    local.get 9
                    i32.load
                    local.tee 17
                    i32.eqz
                    br_if 1 (;@7;)
                    local.get 0
                    i32.load offset=152
                    local.get 0
                    i32.load offset=156
                    local.tee 15
                    i32.le_s
                    br_if 1 (;@7;)
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=136
                      local.get 15
                      i32.const 2
                      i32.shl
                      i32.add
                      local.tee 13
                      i32.load
                      local.tee 5
                      i32.const 1024
                      i32.and
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 15
                      i32.const 1
                      i32.add
                      i32.store offset=156
                      local.get 0
                      local.get 0
                      i64.load offset=464
                      i64.const 1
                      i64.add
                      i64.store offset=464
                      i32.const -3
                      local.set 5
                      br 6 (;@3;)
                    end
                    local.get 5
                    i32.const 512
                    i32.and
                    local.set 18
                    block  ;; label = @9
                      local.get 5
                      i32.const 255
                      i32.and
                      local.tee 6
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 13
                      i32.const 4
                      i32.add
                      local.set 5
                      i32.const 255
                      local.set 6
                      loop  ;; label = @10
                        i32.const 512
                        local.get 18
                        local.get 5
                        i32.load
                        local.tee 13
                        i32.const 512
                        i32.and
                        select
                        local.set 18
                        local.get 5
                        i32.const 4
                        i32.add
                        local.set 5
                        local.get 15
                        i32.const 1
                        i32.add
                        local.set 15
                        local.get 13
                        i32.const 255
                        i32.and
                        local.tee 13
                        local.get 6
                        i32.add
                        local.set 6
                        local.get 13
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 0
                    local.get 15
                    i32.const 1
                    i32.add
                    i32.store offset=156
                    local.get 0
                    local.get 0
                    i32.load offset=132
                    local.tee 13
                    local.get 6
                    i32.add
                    i32.store offset=132
                    local.get 0
                    i32.load offset=140
                    local.get 15
                    i32.const 3
                    i32.shl
                    i32.add
                    i64.load
                    local.set 19
                    local.get 0
                    local.get 0
                    i64.load offset=464
                    local.tee 20
                    i64.const 1
                    i64.add
                    i64.store offset=464
                    local.get 0
                    i32.load offset=624
                    local.tee 5
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 5
                    i32.load offset=4
                    local.tee 14
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 5
                    i32.load offset=72
                    local.tee 21
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 14
                    i32.load offset=28
                    local.tee 16
                    i32.eqz
                    br_if 0 (;@8;)
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=644
                      local.tee 5
                      i32.eqz
                      br_if 0 (;@9;)
                      loop  ;; label = @10
                        local.get 5
                        i32.load offset=4
                        local.set 15
                        local.get 5
                        i32.load
                        call $free
                        local.get 5
                        call $free
                        local.get 15
                        local.set 5
                        local.get 15
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 17
                    local.get 13
                    i32.add
                    local.set 5
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=640
                      local.tee 15
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 0
                      i32.load offset=628
                      local.get 0
                      i32.load offset=636
                      local.get 15
                      i32.add
                      call $realloc
                      i32.store offset=628
                      local.get 0
                      i32.load offset=640
                      local.set 15
                      local.get 0
                      i32.const 0
                      i32.store offset=640
                      local.get 0
                      local.get 15
                      local.get 0
                      i32.load offset=636
                      i32.add
                      i32.store offset=636
                    end
                    local.get 0
                    i32.const 0
                    i32.store offset=644
                    local.get 0
                    i32.const 0
                    i32.store offset=632
                    local.get 0
                    local.get 5
                    i32.store offset=576
                    local.get 0
                    i64.const 0
                    i64.store offset=564 align=4
                    local.get 0
                    local.get 6
                    i32.store offset=580
                    local.get 0
                    local.get 5
                    i32.store offset=572
                    local.get 7
                    i32.const 1
                    call $oggpack_read
                    br_if 0 (;@8;)
                    local.get 7
                    local.get 21
                    i32.load offset=8
                    call $oggpack_read
                    local.tee 5
                    i32.const -1
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 5
                    i32.store offset=600
                    local.get 16
                    local.get 5
                    i32.const 2
                    i32.shl
                    local.tee 22
                    i32.add
                    i32.const 32
                    i32.add
                    i32.load
                    local.tee 5
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 5
                    i32.load
                    local.tee 5
                    i32.store offset=588
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 5
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 7
                        i32.const 1
                        call $oggpack_read
                        i32.store offset=584
                        local.get 0
                        local.get 7
                        i32.const 1
                        call $oggpack_read
                        local.tee 5
                        i32.store offset=592
                        local.get 5
                        i32.const -1
                        i32.eq
                        br_if 2 (;@8;)
                        local.get 0
                        i32.load offset=588
                        local.set 5
                        br 1 (;@9;)
                      end
                      i32.const 0
                      local.set 5
                      local.get 0
                      i32.const 0
                      i32.store offset=592
                      local.get 0
                      i32.const 0
                      i32.store offset=584
                    end
                    local.get 0
                    local.get 20
                    i64.store offset=616
                    local.get 0
                    local.get 19
                    i64.store offset=608
                    local.get 0
                    local.get 18
                    i32.store offset=604
                    local.get 0
                    local.get 16
                    local.get 5
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    i32.store offset=596
                    local.get 0
                    i32.load offset=628
                    local.set 15
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=632
                      local.tee 5
                      local.get 14
                      i32.load offset=4
                      local.tee 23
                      i32.const 2
                      i32.shl
                      i32.const 7
                      i32.add
                      i32.const -8
                      i32.and
                      local.tee 13
                      i32.add
                      local.get 0
                      i32.load offset=636
                      i32.le_s
                      br_if 0 (;@9;)
                      block  ;; label = @10
                        local.get 15
                        i32.eqz
                        br_if 0 (;@10;)
                        i32.const 8
                        call $malloc
                        local.tee 17
                        local.get 15
                        i32.store
                        local.get 0
                        i32.load offset=644
                        local.set 15
                        local.get 0
                        local.get 17
                        i32.store offset=644
                        local.get 17
                        local.get 15
                        i32.store offset=4
                        local.get 0
                        local.get 0
                        i32.load offset=640
                        local.get 5
                        i32.add
                        i32.store offset=640
                      end
                      local.get 0
                      local.get 13
                      i32.store offset=636
                      local.get 0
                      local.get 13
                      call $malloc
                      local.tee 15
                      i32.store offset=628
                      local.get 14
                      i32.load offset=4
                      local.set 23
                      i32.const 0
                      local.set 5
                    end
                    local.get 0
                    local.get 15
                    local.get 5
                    i32.add
                    i32.store offset=560
                    local.get 0
                    local.get 5
                    local.get 13
                    i32.add
                    local.tee 16
                    i32.store offset=632
                    block  ;; label = @9
                      local.get 23
                      i32.const 1
                      i32.lt_s
                      br_if 0 (;@9;)
                      i32.const 0
                      local.set 15
                      i32.const 0
                      local.set 24
                      loop  ;; label = @10
                        local.get 0
                        i32.load offset=628
                        local.set 5
                        block  ;; label = @11
                          block  ;; label = @12
                            local.get 16
                            local.get 0
                            i32.load offset=596
                            i32.const 2
                            i32.shl
                            i32.const 7
                            i32.add
                            i32.const -8
                            i32.and
                            local.tee 13
                            i32.add
                            local.get 0
                            i32.load offset=636
                            i32.gt_s
                            br_if 0 (;@12;)
                            local.get 16
                            local.set 17
                            br 1 (;@11;)
                          end
                          block  ;; label = @12
                            local.get 5
                            i32.eqz
                            br_if 0 (;@12;)
                            i32.const 8
                            call $malloc
                            local.tee 17
                            local.get 5
                            i32.store
                            local.get 0
                            i32.load offset=644
                            local.set 5
                            local.get 0
                            local.get 17
                            i32.store offset=644
                            local.get 17
                            local.get 5
                            i32.store offset=4
                            local.get 0
                            local.get 0
                            i32.load offset=640
                            local.get 16
                            i32.add
                            i32.store offset=640
                          end
                          local.get 0
                          local.get 13
                          i32.store offset=636
                          local.get 0
                          local.get 13
                          call $malloc
                          local.tee 5
                          i32.store offset=628
                          local.get 14
                          i32.load offset=4
                          local.set 23
                          i32.const 0
                          local.set 17
                        end
                        local.get 0
                        local.get 17
                        local.get 13
                        i32.add
                        local.tee 16
                        i32.store offset=632
                        local.get 0
                        i32.load offset=560
                        local.get 15
                        i32.add
                        local.get 5
                        local.get 17
                        i32.add
                        i32.store
                        local.get 15
                        i32.const 4
                        i32.add
                        local.set 15
                        local.get 24
                        i32.const 1
                        i32.add
                        local.tee 24
                        local.get 23
                        i32.lt_s
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 11
                    local.get 21
                    i32.load offset=12
                    local.get 22
                    i32.add
                    i32.load
                    call $vorbis_synthesis
                    br_if 0 (;@8;)
                  end
                  local.get 0
                  i32.load offset=500
                  local.set 15
                  block  ;; label = @8
                    local.get 0
                    i32.load offset=504
                    local.tee 13
                    i32.const 0
                    i32.lt_s
                    br_if 0 (;@8;)
                    i32.const -129
                    local.set 5
                    local.get 13
                    local.get 15
                    i32.lt_s
                    br_if 5 (;@3;)
                  end
                  local.get 0
                  i32.load offset=552
                  local.set 25
                  local.get 0
                  i32.load offset=484
                  local.tee 26
                  i32.load offset=28
                  local.set 27
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 15
                      local.get 13
                      i32.le_s
                      br_if 0 (;@9;)
                      local.get 13
                      i32.const -1
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 13
                      local.set 28
                      br 1 (;@8;)
                    end
                    local.get 0
                    i32.const -1
                    i32.store offset=524
                    local.get 0
                    local.get 0
                    i32.load offset=520
                    local.tee 29
                    i32.store offset=516
                    local.get 0
                    local.get 0
                    i32.load offset=588
                    local.tee 30
                    i32.store offset=520
                    block  ;; label = @9
                      block  ;; label = @10
                        block  ;; label = @11
                          local.get 0
                          i64.load offset=544
                          local.tee 20
                          i64.const -1
                          i64.ne
                          br_if 0 (;@11;)
                          local.get 0
                          i64.load offset=616
                          local.set 31
                          br 1 (;@10;)
                        end
                        local.get 20
                        i64.const 1
                        i64.add
                        local.tee 20
                        local.get 0
                        i64.load offset=616
                        local.tee 31
                        i64.eq
                        br_if 1 (;@9;)
                      end
                      local.get 25
                      i64.const -1
                      i64.store offset=16
                      local.get 0
                      i64.const -1
                      i64.store offset=536
                      local.get 31
                      local.set 20
                    end
                    local.get 0
                    local.get 20
                    i64.store offset=544
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 0
                        i32.load offset=560
                        local.tee 32
                        br_if 0 (;@10;)
                        local.get 13
                        local.set 28
                        br 1 (;@9;)
                      end
                      local.get 27
                      i32.const 4
                      i32.add
                      i32.load
                      local.tee 33
                      i32.const 2
                      i32.div_s
                      local.tee 5
                      i32.const 0
                      local.get 0
                      i32.load offset=528
                      local.tee 15
                      select
                      local.set 28
                      i32.const 0
                      local.get 5
                      local.get 15
                      select
                      local.set 34
                      local.get 27
                      i32.load
                      local.tee 35
                      i32.const 2
                      i32.div_s
                      local.set 36
                      local.get 27
                      local.get 30
                      i32.const 2
                      i32.shl
                      i32.add
                      local.tee 37
                      i32.load
                      local.tee 38
                      i32.const 2
                      i32.div_s
                      local.set 15
                      block  ;; label = @10
                        local.get 26
                        i32.load offset=4
                        i32.const 1
                        i32.lt_s
                        br_if 0 (;@10;)
                        local.get 33
                        i32.const 4
                        i32.div_s
                        local.tee 17
                        local.get 35
                        i32.const 4
                        i32.div_s
                        local.tee 13
                        i32.add
                        local.set 39
                        local.get 17
                        i32.const 2
                        i32.shl
                        local.tee 40
                        local.get 13
                        i32.const 2
                        i32.shl
                        i32.sub
                        local.set 41
                        local.get 34
                        i32.const 2
                        i32.shl
                        local.tee 42
                        local.get 35
                        i32.const -4
                        i32.div_s
                        i32.const 2
                        i32.shl
                        local.tee 43
                        i32.add
                        local.get 40
                        i32.add
                        local.set 44
                        local.get 15
                        i32.const 2
                        i32.shl
                        local.set 45
                        local.get 28
                        i32.const 2
                        i32.shl
                        local.set 46
                        local.get 15
                        i32.const 1073741820
                        i32.and
                        local.set 24
                        local.get 15
                        i32.const 3
                        i32.and
                        local.set 47
                        local.get 36
                        i32.const 1073741820
                        i32.and
                        local.set 21
                        local.get 36
                        i32.const 3
                        i32.and
                        local.set 48
                        local.get 5
                        i32.const 1073741820
                        i32.and
                        local.set 22
                        local.get 5
                        i32.const 3
                        i32.and
                        local.set 49
                        local.get 36
                        i32.const -1
                        i32.add
                        local.set 50
                        i32.const 0
                        local.set 51
                        local.get 0
                        i32.load offset=488
                        local.set 52
                        i32.const 0
                        local.get 13
                        i32.sub
                        i32.const 2
                        i32.shl
                        local.set 53
                        local.get 15
                        i32.const -1
                        i32.add
                        i32.const 3
                        i32.lt_u
                        local.set 54
                        local.get 5
                        i32.const -1
                        i32.add
                        i32.const 3
                        i32.lt_u
                        local.set 55
                        loop  ;; label = @11
                          local.get 52
                          local.get 51
                          i32.const 2
                          i32.shl
                          local.tee 15
                          i32.add
                          i32.load
                          local.tee 56
                          local.get 42
                          i32.add
                          local.set 5
                          block  ;; label = @12
                            block  ;; label = @13
                              local.get 29
                              i32.eqz
                              br_if 0 (;@13;)
                              block  ;; label = @14
                                local.get 30
                                i32.eqz
                                br_if 0 (;@14;)
                                local.get 32
                                local.get 15
                                i32.add
                                i32.load
                                local.set 16
                                local.get 33
                                i32.const 2
                                i32.lt_s
                                br_if 2 (;@12;)
                                i32.const 0
                                local.set 14
                                block  ;; label = @15
                                  local.get 55
                                  br_if 0 (;@15;)
                                  i32.const 0
                                  local.set 13
                                  i32.const 0
                                  local.set 14
                                  loop  ;; label = @16
                                    local.get 5
                                    local.get 13
                                    i32.add
                                    local.tee 15
                                    local.get 15
                                    i32.load
                                    local.get 16
                                    local.get 13
                                    i32.add
                                    local.tee 17
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 15
                                    i32.const 4
                                    i32.add
                                    local.tee 23
                                    local.get 23
                                    i32.load
                                    local.get 17
                                    i32.const 4
                                    i32.add
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 15
                                    i32.const 8
                                    i32.add
                                    local.tee 23
                                    local.get 23
                                    i32.load
                                    local.get 17
                                    i32.const 8
                                    i32.add
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 15
                                    i32.const 12
                                    i32.add
                                    local.tee 15
                                    local.get 15
                                    i32.load
                                    local.get 17
                                    i32.const 12
                                    i32.add
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 13
                                    i32.const 16
                                    i32.add
                                    local.set 13
                                    local.get 22
                                    local.get 14
                                    i32.const 4
                                    i32.add
                                    local.tee 14
                                    i32.ne
                                    br_if 0 (;@16;)
                                  end
                                end
                                local.get 49
                                i32.eqz
                                br_if 2 (;@12;)
                                local.get 14
                                i32.const 2
                                i32.shl
                                local.set 15
                                local.get 49
                                local.set 13
                                loop  ;; label = @15
                                  local.get 5
                                  local.get 15
                                  i32.add
                                  local.tee 17
                                  local.get 17
                                  i32.load
                                  local.get 16
                                  local.get 15
                                  i32.add
                                  i32.load
                                  i32.add
                                  i32.store
                                  local.get 15
                                  i32.const 4
                                  i32.add
                                  local.set 15
                                  local.get 13
                                  i32.const -1
                                  i32.add
                                  local.tee 13
                                  br_if 0 (;@15;)
                                  br 3 (;@12;)
                                end
                              end
                              local.get 32
                              local.get 15
                              i32.add
                              i32.load
                              local.set 16
                              local.get 35
                              i32.const 2
                              i32.lt_s
                              br_if 1 (;@12;)
                              i32.const 0
                              local.set 13
                              block  ;; label = @14
                                local.get 50
                                i32.const 3
                                i32.lt_u
                                br_if 0 (;@14;)
                                local.get 5
                                local.get 40
                                i32.add
                                local.get 43
                                i32.add
                                local.set 5
                                i32.const 0
                                local.set 13
                                local.get 16
                                local.set 15
                                loop  ;; label = @15
                                  local.get 5
                                  local.get 5
                                  i32.load
                                  local.get 15
                                  i32.load
                                  i32.add
                                  i32.store
                                  local.get 5
                                  i32.const 4
                                  i32.add
                                  local.tee 17
                                  local.get 17
                                  i32.load
                                  local.get 15
                                  i32.const 4
                                  i32.add
                                  i32.load
                                  i32.add
                                  i32.store
                                  local.get 5
                                  i32.const 8
                                  i32.add
                                  local.tee 17
                                  local.get 17
                                  i32.load
                                  local.get 15
                                  i32.const 8
                                  i32.add
                                  i32.load
                                  i32.add
                                  i32.store
                                  local.get 5
                                  i32.const 12
                                  i32.add
                                  local.tee 17
                                  local.get 17
                                  i32.load
                                  local.get 15
                                  i32.const 12
                                  i32.add
                                  i32.load
                                  i32.add
                                  i32.store
                                  local.get 5
                                  i32.const 16
                                  i32.add
                                  local.set 5
                                  local.get 15
                                  i32.const 16
                                  i32.add
                                  local.set 15
                                  local.get 21
                                  local.get 13
                                  i32.const 4
                                  i32.add
                                  local.tee 13
                                  i32.ne
                                  br_if 0 (;@15;)
                                end
                              end
                              local.get 48
                              i32.eqz
                              br_if 1 (;@12;)
                              local.get 56
                              local.get 44
                              i32.add
                              local.get 13
                              i32.const 2
                              i32.shl
                              local.tee 15
                              i32.add
                              local.set 5
                              local.get 16
                              local.get 15
                              i32.add
                              local.set 15
                              local.get 48
                              local.set 13
                              loop  ;; label = @14
                                local.get 5
                                local.get 5
                                i32.load
                                local.get 15
                                i32.load
                                i32.add
                                i32.store
                                local.get 15
                                i32.const 4
                                i32.add
                                local.set 15
                                local.get 5
                                i32.const 4
                                i32.add
                                local.set 5
                                local.get 13
                                i32.const -1
                                i32.add
                                local.tee 13
                                br_if 0 (;@14;)
                                br 2 (;@12;)
                              end
                            end
                            local.get 32
                            local.get 15
                            i32.add
                            i32.load
                            local.set 16
                            block  ;; label = @13
                              local.get 30
                              i32.eqz
                              br_if 0 (;@13;)
                              i32.const 0
                              local.set 17
                              block  ;; label = @14
                                local.get 35
                                i32.const 2
                                i32.lt_s
                                br_if 0 (;@14;)
                                i32.const 0
                                local.set 13
                                block  ;; label = @15
                                  local.get 50
                                  i32.const 3
                                  i32.lt_u
                                  br_if 0 (;@15;)
                                  local.get 16
                                  local.get 40
                                  i32.add
                                  local.get 53
                                  i32.add
                                  local.set 15
                                  i32.const 0
                                  local.set 13
                                  loop  ;; label = @16
                                    local.get 5
                                    local.get 5
                                    i32.load
                                    local.get 15
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 5
                                    i32.const 4
                                    i32.add
                                    local.tee 17
                                    local.get 17
                                    i32.load
                                    local.get 15
                                    i32.const 4
                                    i32.add
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 5
                                    i32.const 8
                                    i32.add
                                    local.tee 17
                                    local.get 17
                                    i32.load
                                    local.get 15
                                    i32.const 8
                                    i32.add
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 5
                                    i32.const 12
                                    i32.add
                                    local.tee 17
                                    local.get 17
                                    i32.load
                                    local.get 15
                                    i32.const 12
                                    i32.add
                                    i32.load
                                    i32.add
                                    i32.store
                                    local.get 15
                                    i32.const 16
                                    i32.add
                                    local.set 15
                                    local.get 5
                                    i32.const 16
                                    i32.add
                                    local.set 5
                                    local.get 21
                                    local.get 13
                                    i32.const 4
                                    i32.add
                                    local.tee 13
                                    i32.ne
                                    br_if 0 (;@16;)
                                  end
                                end
                                local.get 36
                                local.set 17
                                local.get 48
                                i32.eqz
                                br_if 0 (;@14;)
                                local.get 16
                                local.get 41
                                i32.add
                                local.get 13
                                i32.const 2
                                i32.shl
                                local.tee 5
                                i32.add
                                local.set 15
                                local.get 56
                                local.get 42
                                i32.add
                                local.get 5
                                i32.add
                                local.set 5
                                local.get 48
                                local.set 13
                                loop  ;; label = @15
                                  local.get 5
                                  local.get 5
                                  i32.load
                                  local.get 15
                                  i32.load
                                  i32.add
                                  i32.store
                                  local.get 15
                                  i32.const 4
                                  i32.add
                                  local.set 15
                                  local.get 5
                                  i32.const 4
                                  i32.add
                                  local.set 5
                                  local.get 13
                                  i32.const -1
                                  i32.add
                                  local.tee 13
                                  br_if 0 (;@15;)
                                end
                                local.get 36
                                local.set 17
                              end
                              local.get 17
                              local.get 39
                              i32.ge_s
                              br_if 1 (;@12;)
                              local.get 17
                              local.set 57
                              block  ;; label = @14
                                local.get 39
                                local.get 17
                                i32.sub
                                i32.const 3
                                i32.and
                                local.tee 23
                                i32.eqz
                                br_if 0 (;@14;)
                                local.get 16
                                local.get 41
                                i32.add
                                local.get 17
                                i32.const 2
                                i32.shl
                                local.tee 15
                                i32.add
                                local.set 5
                                local.get 56
                                local.get 42
                                i32.add
                                local.get 15
                                i32.add
                                local.set 15
                                local.get 17
                                local.get 23
                                i32.add
                                local.set 57
                                local.get 23
                                local.set 13
                                loop  ;; label = @15
                                  local.get 15
                                  local.get 5
                                  i32.load
                                  i32.store
                                  local.get 5
                                  i32.const 4
                                  i32.add
                                  local.set 5
                                  local.get 15
                                  i32.const 4
                                  i32.add
                                  local.set 15
                                  local.get 13
                                  i32.const -1
                                  i32.add
                                  local.tee 13
                                  br_if 0 (;@15;)
                                end
                              end
                              local.get 17
                              local.get 39
                              i32.sub
                              i32.const -4
                              i32.gt_u
                              br_if 1 (;@12;)
                              local.get 16
                              local.get 41
                              i32.add
                              local.get 57
                              i32.const 2
                              i32.shl
                              i32.add
                              local.set 14
                              local.get 56
                              local.get 42
                              i32.add
                              local.get 17
                              i32.const 2
                              i32.shl
                              local.get 23
                              i32.const 2
                              i32.shl
                              i32.add
                              i32.add
                              local.set 23
                              local.get 39
                              local.get 57
                              i32.sub
                              local.set 17
                              i32.const 0
                              local.set 5
                              loop  ;; label = @14
                                local.get 23
                                local.get 5
                                i32.add
                                local.tee 15
                                local.get 14
                                local.get 5
                                i32.add
                                local.tee 13
                                i32.load
                                i32.store
                                local.get 15
                                i32.const 4
                                i32.add
                                local.get 13
                                i32.const 4
                                i32.add
                                i32.load
                                i32.store
                                local.get 15
                                i32.const 8
                                i32.add
                                local.get 13
                                i32.const 8
                                i32.add
                                i32.load
                                i32.store
                                local.get 15
                                i32.const 12
                                i32.add
                                local.get 13
                                i32.const 12
                                i32.add
                                i32.load
                                i32.store
                                local.get 5
                                i32.const 16
                                i32.add
                                local.set 5
                                local.get 17
                                i32.const -4
                                i32.add
                                local.tee 17
                                br_if 0 (;@14;)
                                br 2 (;@12;)
                              end
                            end
                            local.get 35
                            i32.const 2
                            i32.lt_s
                            br_if 0 (;@12;)
                            i32.const 0
                            local.set 14
                            block  ;; label = @13
                              local.get 50
                              i32.const 3
                              i32.lt_u
                              br_if 0 (;@13;)
                              i32.const 0
                              local.set 13
                              i32.const 0
                              local.set 14
                              loop  ;; label = @14
                                local.get 5
                                local.get 13
                                i32.add
                                local.tee 15
                                local.get 15
                                i32.load
                                local.get 16
                                local.get 13
                                i32.add
                                local.tee 17
                                i32.load
                                i32.add
                                i32.store
                                local.get 15
                                i32.const 4
                                i32.add
                                local.tee 23
                                local.get 23
                                i32.load
                                local.get 17
                                i32.const 4
                                i32.add
                                i32.load
                                i32.add
                                i32.store
                                local.get 15
                                i32.const 8
                                i32.add
                                local.tee 23
                                local.get 23
                                i32.load
                                local.get 17
                                i32.const 8
                                i32.add
                                i32.load
                                i32.add
                                i32.store
                                local.get 15
                                i32.const 12
                                i32.add
                                local.tee 15
                                local.get 15
                                i32.load
                                local.get 17
                                i32.const 12
                                i32.add
                                i32.load
                                i32.add
                                i32.store
                                local.get 13
                                i32.const 16
                                i32.add
                                local.set 13
                                local.get 21
                                local.get 14
                                i32.const 4
                                i32.add
                                local.tee 14
                                i32.ne
                                br_if 0 (;@14;)
                              end
                            end
                            local.get 48
                            i32.eqz
                            br_if 0 (;@12;)
                            local.get 14
                            i32.const 2
                            i32.shl
                            local.set 15
                            local.get 48
                            local.set 13
                            loop  ;; label = @13
                              local.get 5
                              local.get 15
                              i32.add
                              local.tee 17
                              local.get 17
                              i32.load
                              local.get 16
                              local.get 15
                              i32.add
                              i32.load
                              i32.add
                              i32.store
                              local.get 15
                              i32.const 4
                              i32.add
                              local.set 15
                              local.get 13
                              i32.const -1
                              i32.add
                              local.tee 13
                              br_if 0 (;@13;)
                            end
                          end
                          block  ;; label = @12
                            local.get 38
                            i32.const 2
                            i32.lt_s
                            br_if 0 (;@12;)
                            local.get 16
                            local.get 45
                            i32.add
                            local.set 16
                            local.get 56
                            local.get 46
                            i32.add
                            local.set 14
                            i32.const 0
                            local.set 17
                            block  ;; label = @13
                              local.get 54
                              br_if 0 (;@13;)
                              i32.const 0
                              local.set 5
                              i32.const 0
                              local.set 17
                              loop  ;; label = @14
                                local.get 14
                                local.get 5
                                i32.add
                                local.tee 15
                                local.get 16
                                local.get 5
                                i32.add
                                local.tee 13
                                i32.load
                                i32.store
                                local.get 15
                                i32.const 4
                                i32.add
                                local.get 13
                                i32.const 4
                                i32.add
                                i32.load
                                i32.store
                                local.get 15
                                i32.const 8
                                i32.add
                                local.get 13
                                i32.const 8
                                i32.add
                                i32.load
                                i32.store
                                local.get 15
                                i32.const 12
                                i32.add
                                local.get 13
                                i32.const 12
                                i32.add
                                i32.load
                                i32.store
                                local.get 5
                                i32.const 16
                                i32.add
                                local.set 5
                                local.get 24
                                local.get 17
                                i32.const 4
                                i32.add
                                local.tee 17
                                i32.ne
                                br_if 0 (;@14;)
                              end
                            end
                            local.get 47
                            i32.eqz
                            br_if 0 (;@12;)
                            local.get 16
                            local.get 17
                            i32.const 2
                            i32.shl
                            local.tee 15
                            i32.add
                            local.set 5
                            local.get 14
                            local.get 15
                            i32.add
                            local.set 15
                            local.get 47
                            local.set 13
                            loop  ;; label = @13
                              local.get 15
                              local.get 5
                              i32.load
                              i32.store
                              local.get 5
                              i32.const 4
                              i32.add
                              local.set 5
                              local.get 15
                              i32.const 4
                              i32.add
                              local.set 15
                              local.get 13
                              i32.const -1
                              i32.add
                              local.tee 13
                              br_if 0 (;@13;)
                            end
                          end
                          local.get 51
                          i32.const 1
                          i32.add
                          local.tee 51
                          local.get 26
                          i32.load offset=4
                          i32.lt_s
                          br_if 0 (;@11;)
                        end
                        local.get 0
                        i32.load offset=504
                        local.set 13
                      end
                      local.get 0
                      local.get 34
                      i32.store offset=528
                      local.get 28
                      local.set 15
                      block  ;; label = @10
                        local.get 13
                        i32.const -1
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 27
                        local.get 29
                        i32.const 2
                        i32.shl
                        i32.add
                        i32.load
                        i32.const 4
                        i32.div_s
                        local.get 34
                        i32.add
                        local.get 37
                        i32.load
                        i32.const 4
                        i32.div_s
                        i32.add
                        local.set 15
                        local.get 34
                        local.set 28
                      end
                      local.get 0
                      local.get 15
                      i32.store offset=500
                      local.get 0
                      local.get 28
                      i32.store offset=504
                    end
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 25
                        i64.load offset=16
                        local.tee 20
                        i64.const -1
                        i64.ne
                        br_if 0 (;@10;)
                        i64.const 0
                        local.set 20
                        br 1 (;@9;)
                      end
                      local.get 20
                      local.get 27
                      local.get 30
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      i32.const 4
                      i32.div_s
                      local.get 27
                      local.get 29
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      i32.const 4
                      i32.div_s
                      i32.add
                      i64.extend_i32_s
                      i64.add
                      local.set 20
                    end
                    local.get 25
                    local.get 20
                    i64.store offset=16
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 0
                        i64.load offset=536
                        local.tee 31
                        i64.const -1
                        i64.ne
                        br_if 0 (;@10;)
                        local.get 0
                        i64.load offset=608
                        local.tee 31
                        i64.const -1
                        i64.eq
                        br_if 1 (;@9;)
                        local.get 0
                        local.get 31
                        i64.store offset=536
                        local.get 20
                        local.get 31
                        i64.le_s
                        br_if 1 (;@9;)
                        local.get 20
                        local.get 31
                        i64.sub
                        i32.wrap_i64
                        local.tee 5
                        i32.const 0
                        local.get 5
                        i32.const 0
                        i32.gt_s
                        select
                        local.set 5
                        block  ;; label = @11
                          local.get 0
                          i32.load offset=604
                          i32.eqz
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 15
                          local.get 5
                          local.get 15
                          local.get 28
                          i32.sub
                          local.tee 13
                          local.get 5
                          local.get 13
                          i32.lt_s
                          select
                          i32.sub
                          local.tee 15
                          i32.store offset=500
                          br 2 (;@9;)
                        end
                        local.get 0
                        local.get 28
                        local.get 5
                        i32.add
                        local.tee 5
                        local.get 15
                        local.get 5
                        local.get 15
                        i32.lt_s
                        select
                        local.tee 28
                        i32.store offset=504
                        br 1 (;@9;)
                      end
                      local.get 0
                      local.get 31
                      local.get 27
                      local.get 30
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      i32.const 4
                      i32.div_s
                      local.get 27
                      local.get 29
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      i32.const 4
                      i32.div_s
                      i32.add
                      i64.extend_i32_s
                      i64.add
                      local.tee 31
                      i64.store offset=536
                      local.get 0
                      i64.load offset=608
                      local.tee 20
                      i64.const -1
                      i64.eq
                      br_if 0 (;@9;)
                      local.get 31
                      local.get 20
                      i64.eq
                      br_if 0 (;@9;)
                      block  ;; label = @10
                        local.get 31
                        local.get 20
                        i64.le_s
                        br_if 0 (;@10;)
                        local.get 31
                        local.get 20
                        i64.sub
                        i32.wrap_i64
                        local.tee 5
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 0
                        i32.load offset=604
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 15
                        local.get 15
                        local.get 28
                        i32.sub
                        local.tee 13
                        local.get 5
                        local.get 13
                        local.get 5
                        i32.lt_s
                        select
                        local.tee 5
                        i32.const 0
                        local.get 5
                        i32.const 0
                        i32.gt_s
                        select
                        i32.sub
                        local.tee 15
                        i32.store offset=500
                      end
                      local.get 0
                      local.get 20
                      i64.store offset=536
                    end
                    local.get 0
                    i32.load offset=604
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 0
                    i32.const 1
                    i32.store offset=512
                  end
                  local.get 0
                  local.get 0
                  i64.load offset=104
                  local.get 6
                  i32.const 3
                  i32.shl
                  i64.extend_i32_s
                  i64.add
                  i64.store offset=104
                  local.get 0
                  local.get 0
                  i64.load offset=112
                  local.get 15
                  local.get 28
                  i32.sub
                  i64.extend_i32_s
                  i64.const 0
                  local.get 15
                  local.get 28
                  i32.gt_s
                  select
                  i64.const 0
                  local.get 28
                  i32.const -1
                  i32.gt_s
                  select
                  local.tee 20
                  i64.add
                  i64.store offset=112
                  i32.const 1
                  local.set 5
                  local.get 19
                  i64.const -1
                  i64.eq
                  br_if 4 (;@3;)
                  local.get 18
                  br_if 4 (;@3;)
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=4
                      br_if 0 (;@9;)
                      i32.const 0
                      local.set 18
                      br 1 (;@8;)
                    end
                    local.get 0
                    i32.load offset=96
                    local.tee 18
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 19
                    local.get 0
                    i32.load offset=68
                    local.get 18
                    i32.const 4
                    i32.shl
                    i32.add
                    i64.load
                    i64.sub
                    local.set 19
                  end
                  local.get 19
                  i64.const 0
                  local.get 19
                  i64.const 0
                  i64.gt_s
                  select
                  local.get 20
                  i64.sub
                  local.set 19
                  block  ;; label = @8
                    local.get 18
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 18
                    i32.const 3
                    i32.and
                    local.set 6
                    local.get 0
                    i32.load offset=68
                    local.set 13
                    i32.const 0
                    local.set 17
                    block  ;; label = @9
                      local.get 18
                      i32.const 4
                      i32.lt_u
                      br_if 0 (;@9;)
                      local.get 13
                      i32.const 56
                      i32.add
                      local.set 15
                      local.get 18
                      i32.const 2147483644
                      i32.and
                      local.tee 17
                      local.set 18
                      loop  ;; label = @10
                        local.get 15
                        i64.load
                        local.get 15
                        i32.const -16
                        i32.add
                        i64.load
                        local.get 15
                        i32.const -32
                        i32.add
                        i64.load
                        local.get 15
                        i32.const -48
                        i32.add
                        i64.load
                        local.get 19
                        i64.add
                        i64.add
                        i64.add
                        i64.add
                        local.set 19
                        local.get 15
                        i32.const 64
                        i32.add
                        local.set 15
                        local.get 18
                        i32.const -4
                        i32.add
                        local.tee 18
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 6
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 13
                    local.get 17
                    i32.const 4
                    i32.shl
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 15
                    loop  ;; label = @9
                      local.get 15
                      i64.load
                      local.get 19
                      i64.add
                      local.set 19
                      local.get 15
                      i32.const 16
                      i32.add
                      local.set 15
                      local.get 6
                      i32.const -1
                      i32.add
                      local.tee 6
                      br_if 0 (;@9;)
                    end
                  end
                  local.get 0
                  local.get 19
                  i64.store offset=80
                  br 4 (;@3;)
                end
                local.get 0
                i32.load offset=88
                local.set 6
              end
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        local.get 6
                        i32.const 2
                        i32.lt_s
                        br_if 0 (;@10;)
                        block  ;; label = @11
                          loop  ;; label = @12
                            block  ;; label = @13
                              local.get 0
                              local.get 4
                              i64.const -1
                              call $_get_next_page
                              i64.const -1
                              i64.gt_s
                              br_if 0 (;@13;)
                              i32.const 0
                              local.set 5
                              br 12 (;@1;)
                            end
                            local.get 0
                            local.get 0
                            i64.load offset=104
                            local.get 4
                            i32.load offset=4
                            i32.const 3
                            i32.shl
                            i64.extend_i32_s
                            i64.add
                            i64.store offset=104
                            local.get 0
                            i32.load offset=88
                            local.tee 6
                            i32.const 4
                            i32.ne
                            br_if 1 (;@11;)
                            local.get 0
                            i32.load offset=92
                            local.get 4
                            i32.load
                            local.tee 5
                            i32.const 14
                            i32.add
                            i32.load align=1
                            i32.eq
                            br_if 6 (;@6;)
                            local.get 5
                            i32.const 5
                            i32.add
                            i32.load8_u
                            i32.const 2
                            i32.and
                            i32.eqz
                            br_if 0 (;@12;)
                          end
                          local.get 12
                          call $vorbis_dsp_clear
                          local.get 11
                          call $vorbis_block_clear
                          i32.const 2
                          local.set 6
                          local.get 0
                          i32.const 2
                          i32.store offset=88
                          local.get 0
                          i32.load offset=4
                          br_if 2 (;@9;)
                          local.get 0
                          i32.load offset=72
                          call $vorbis_info_clear
                          local.get 0
                          i32.load offset=76
                          call $vorbis_comment_clear
                          local.get 0
                          i32.load offset=88
                          local.tee 6
                          i32.const 4
                          i32.eq
                          br_if 5 (;@6;)
                        end
                        local.get 6
                        i32.const 2
                        i32.gt_s
                        br_if 4 (;@6;)
                      end
                      local.get 0
                      i32.load offset=4
                      i32.eqz
                      br_if 1 (;@8;)
                    end
                    local.get 4
                    i32.load
                    i32.const 14
                    i32.add
                    i32.load align=1
                    local.set 18
                    block  ;; label = @9
                      local.get 0
                      i32.load offset=52
                      local.tee 13
                      i32.const 1
                      i32.ge_s
                      br_if 0 (;@9;)
                      i32.const 0
                      local.set 15
                      br 2 (;@7;)
                    end
                    local.get 0
                    i32.load offset=64
                    local.set 5
                    i32.const 0
                    local.set 15
                    loop  ;; label = @9
                      local.get 5
                      i32.load
                      local.get 18
                      i32.eq
                      br_if 2 (;@7;)
                      local.get 5
                      i32.const 4
                      i32.add
                      local.set 5
                      local.get 13
                      local.get 15
                      i32.const 1
                      i32.add
                      local.tee 15
                      i32.eq
                      br_if 4 (;@5;)
                      br 0 (;@9;)
                    end
                  end
                  block  ;; label = @8
                    local.get 0
                    local.get 0
                    i32.load offset=72
                    local.get 0
                    i32.load offset=76
                    i32.const 0
                    i32.const 0
                    local.get 4
                    call $_fetch_headers
                    local.tee 5
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 0
                    i32.load offset=456
                    i32.store offset=92
                    local.get 0
                    local.get 0
                    i32.load offset=96
                    i32.const 1
                    i32.add
                    i32.store offset=96
                    br 2 (;@6;)
                  end
                  local.get 5
                  i32.const -2
                  i32.ne
                  br_if 4 (;@3;)
                  i32.const 0
                  local.set 5
                  br 6 (;@1;)
                end
                local.get 15
                local.get 13
                i32.eq
                br_if 1 (;@5;)
                local.get 0
                local.get 15
                i32.store offset=96
                local.get 0
                local.get 18
                i32.store offset=92
                block  ;; label = @7
                  local.get 0
                  i32.load offset=120
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 0
                  i32.const -1
                  i32.store offset=460
                  local.get 0
                  i32.const 0
                  i32.store offset=452
                  local.get 0
                  i64.const 0
                  i64.store offset=444 align=4
                  local.get 0
                  i32.const 0
                  i32.store offset=156
                  local.get 0
                  i64.const 0
                  i64.store offset=148 align=4
                  local.get 0
                  i64.const 0
                  i64.store offset=128
                  local.get 8
                  i64.const 0
                  i64.store
                  local.get 0
                  local.get 18
                  i32.store offset=456
                  local.get 8
                  i32.const 8
                  i32.add
                  i64.const 0
                  i64.store
                end
                local.get 0
                i32.const 3
                i32.store offset=88
              end
              local.get 9
              local.get 4
              call $ogg_stream_pagein
              local.get 0
              i32.load offset=88
              local.set 6
              br 0 (;@5;)
            end
          end
          local.get 5
          i32.const 1
          i32.lt_s
          br_if 2 (;@1;)
          local.get 0
          i32.load offset=72
          local.set 15
          block  ;; label = @4
            local.get 0
            i32.load offset=4
            i32.eqz
            br_if 0 (;@4;)
            local.get 15
            local.get 0
            i32.load offset=96
            i32.const 5
            i32.shl
            i32.add
            local.set 15
          end
          local.get 5
          local.get 2
          local.get 15
          i32.load offset=4
          local.tee 12
          i32.const 1
          i32.shl
          local.tee 17
          i32.div_s
          local.tee 7
          local.get 5
          local.get 7
          i32.lt_s
          select
          local.set 10
          block  ;; label = @4
            local.get 12
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 0
            i32.load offset=492
            local.set 11
            local.get 12
            i32.const 2
            i32.shl
            local.set 16
            local.get 10
            i32.const 1
            local.get 10
            i32.const 1
            i32.gt_s
            select
            local.tee 5
            i32.const 2147483646
            i32.and
            local.set 9
            local.get 5
            i32.const 1
            i32.and
            local.set 22
            local.get 1
            local.set 23
            i32.const 0
            local.set 24
            loop  ;; label = @5
              block  ;; label = @6
                local.get 7
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                local.get 11
                local.get 24
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.set 21
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 10
                    i32.const 2
                    i32.ge_s
                    br_if 0 (;@8;)
                    local.get 1
                    local.get 24
                    i32.const 1
                    i32.shl
                    i32.add
                    local.set 5
                    i32.const 0
                    local.set 18
                    br 1 (;@7;)
                  end
                  i32.const 0
                  local.set 18
                  local.get 21
                  local.set 15
                  local.get 23
                  local.set 5
                  loop  ;; label = @8
                    local.get 5
                    local.get 15
                    i32.load
                    i32.const 9
                    i32.shr_s
                    local.tee 6
                    i32.const 32767
                    local.get 6
                    i32.const 32767
                    i32.lt_s
                    select
                    local.get 6
                    i32.const 32768
                    i32.xor
                    i32.const 0
                    local.get 6
                    i32.const -32768
                    i32.lt_s
                    select
                    i32.sub
                    i32.store16
                    local.get 5
                    local.get 17
                    i32.add
                    local.get 15
                    i32.const 4
                    i32.add
                    i32.load
                    i32.const 9
                    i32.shr_s
                    local.tee 6
                    i32.const 32767
                    local.get 6
                    i32.const 32767
                    i32.lt_s
                    select
                    local.get 6
                    i32.const 32768
                    i32.xor
                    i32.const 0
                    local.get 6
                    i32.const -32768
                    i32.lt_s
                    select
                    i32.sub
                    i32.store16
                    local.get 15
                    i32.const 8
                    i32.add
                    local.set 15
                    local.get 5
                    local.get 16
                    i32.add
                    local.set 5
                    local.get 9
                    local.get 18
                    i32.const 2
                    i32.add
                    local.tee 18
                    i32.ne
                    br_if 0 (;@8;)
                  end
                end
                local.get 22
                i32.eqz
                br_if 0 (;@6;)
                local.get 5
                local.get 21
                local.get 18
                i32.const 2
                i32.shl
                i32.add
                i32.load
                i32.const 9
                i32.shr_s
                local.tee 15
                i32.const 32767
                local.get 15
                i32.const 32767
                i32.lt_s
                select
                local.get 15
                i32.const 32768
                i32.xor
                i32.const 0
                local.get 15
                i32.const -32768
                i32.lt_s
                select
                i32.sub
                i32.store16
              end
              local.get 23
              i32.const 2
              i32.add
              local.set 23
              local.get 24
              i32.const 1
              i32.add
              local.tee 24
              local.get 12
              i32.ne
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            block  ;; label = @5
              local.get 7
              i32.eqz
              br_if 0 (;@5;)
              local.get 13
              local.get 10
              i32.add
              local.tee 13
              local.get 14
              i32.gt_s
              br_if 1 (;@4;)
            end
            local.get 0
            local.get 13
            i32.store offset=504
          end
          local.get 0
          local.get 0
          i64.load offset=80
          local.get 10
          i64.extend_i32_s
          i64.add
          i64.store offset=80
          block  ;; label = @4
            local.get 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 3
            local.get 0
            i32.load offset=96
            i32.store
          end
          local.get 17
          local.get 10
          i32.mul
          local.set 5
          br 2 (;@1;)
        end
        local.get 5
        i32.const 0
        i32.le_s
        br_if 1 (;@1;)
        local.get 0
        i32.load offset=88
        local.set 6
        br 0 (;@2;)
      end
    end
    local.get 4
    i32.const 16
    i32.add
    global.set $__stack_pointer
    local.get 5)
  (func $mem_close (type 1) (param i32) (result i32)
    i32.const 0)
  (func $mem_tell (type 1) (param i32) (result i32)
    local.get 0
    i32.load offset=8)
  (func $release (type 4) (param i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.load
      call $free
      local.get 0
      call $free
    end)
  (func $emmalloc_memalign (type 1) (param i32) (result i32)
    (local i32 i32 i32 i64 i64 i32 i32 i32)
    i32.const 0
    local.set 1
    block  ;; label = @1
      local.get 0
      i32.const -57
      i32.gt_u
      br_if 0 (;@1;)
      loop  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 0
            i32.const 3
            i32.add
            i32.const -4
            i32.and
            i32.const 8
            local.get 0
            i32.const 8
            i32.gt_u
            select
            local.tee 0
            i32.const 127
            i32.gt_u
            br_if 0 (;@4;)
            local.get 0
            i32.const 3
            i32.shr_u
            i32.const -1
            i32.add
            local.set 2
            br 1 (;@3;)
          end
          local.get 0
          i32.clz
          local.set 3
          block  ;; label = @4
            local.get 0
            i32.const 4095
            i32.gt_u
            br_if 0 (;@4;)
            local.get 0
            i32.const 29
            local.get 3
            i32.sub
            i32.shr_u
            i32.const 4
            i32.xor
            local.get 3
            i32.const 2
            i32.shl
            i32.sub
            i32.const 110
            i32.add
            local.set 2
            br 1 (;@3;)
          end
          local.get 0
          i32.const 30
          local.get 3
          i32.sub
          i32.shr_u
          i32.const 2
          i32.xor
          local.get 3
          i32.const 1
          i32.shl
          i32.sub
          i32.const 71
          i32.add
          local.tee 3
          i32.const 63
          local.get 3
          i32.const 63
          i32.lt_u
          select
          local.set 2
        end
        block  ;; label = @3
          i32.const 0
          i64.load offset=16799496
          local.tee 4
          local.get 2
          i64.extend_i32_u
          i64.shr_u
          local.tee 5
          i64.eqz
          br_if 0 (;@3;)
          loop  ;; label = @4
            local.get 5
            local.get 5
            i64.ctz
            local.tee 4
            i64.shr_u
            local.set 5
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                local.get 4
                i32.wrap_i64
                i32.add
                local.tee 2
                i32.const 4
                i32.shl
                local.tee 6
                i32.const 16798360
                i32.add
                i32.load
                local.tee 3
                local.get 6
                i32.const 16798352
                i32.add
                local.tee 7
                i32.eq
                br_if 0 (;@6;)
                local.get 3
                local.get 0
                call $emmalloc_attempt_allocate
                local.tee 1
                br_if 5 (;@1;)
                local.get 3
                i32.load offset=4
                local.get 3
                i32.load offset=8
                local.tee 1
                i32.store offset=8
                local.get 1
                local.get 3
                i32.load offset=4
                i32.store offset=4
                local.get 3
                local.get 7
                i32.store offset=8
                local.get 3
                local.get 6
                i32.const 16798356
                i32.add
                local.tee 6
                i32.load
                i32.store offset=4
                local.get 6
                local.get 3
                i32.store
                local.get 3
                i32.load offset=4
                local.get 3
                i32.store offset=8
                local.get 5
                i64.const 1
                i64.shr_u
                local.set 5
                local.get 2
                i32.const 1
                i32.add
                local.set 2
                br 1 (;@5;)
              end
              i32.const 0
              i32.const 0
              i64.load offset=16799496
              i64.const -2
              local.get 2
              i64.extend_i32_u
              i64.rotl
              i64.and
              i64.store offset=16799496
              local.get 5
              i64.const 1
              i64.xor
              local.set 5
            end
            local.get 5
            i64.const 0
            i64.ne
            br_if 0 (;@4;)
          end
          i32.const 0
          i64.load offset=16799496
          local.set 4
        end
        i32.const 63
        local.get 4
        i64.clz
        i32.wrap_i64
        i32.sub
        local.set 7
        block  ;; label = @3
          block  ;; label = @4
            local.get 4
            i64.eqz
            i32.eqz
            br_if 0 (;@4;)
            i32.const 0
            local.set 3
            br 1 (;@3;)
          end
          local.get 7
          i32.const 4
          i32.shl
          local.tee 2
          i32.const 16798360
          i32.add
          i32.load
          local.set 3
          local.get 4
          i64.const 1073741824
          i64.lt_u
          br_if 0 (;@3;)
          local.get 3
          local.get 2
          i32.const 16798352
          i32.add
          local.tee 6
          i32.eq
          br_if 0 (;@3;)
          i32.const -100
          local.set 2
          loop  ;; label = @4
            local.get 2
            i32.const 1
            i32.add
            local.tee 2
            i32.eqz
            br_if 1 (;@3;)
            local.get 3
            local.get 0
            call $emmalloc_attempt_allocate
            local.tee 1
            br_if 3 (;@1;)
            local.get 3
            i32.load offset=8
            local.tee 3
            local.get 6
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 6
          local.set 3
        end
        block  ;; label = @3
          block  ;; label = @4
            i32.const 0
            i32.load offset=16799504
            br_if 0 (;@4;)
            local.get 0
            i32.const 48
            i32.add
            local.set 1
            i32.const 16842752
            local.set 6
            block  ;; label = @5
              i32.const 16842752
              br_if 0 (;@5;)
              memory.size
              i32.const 16
              i32.shl
              local.set 6
            end
            i32.const 16799536
            local.set 2
            local.get 6
            i32.const 16799536
            i32.sub
            local.get 1
            i32.ge_u
            br_if 1 (;@3;)
          end
          block  ;; label = @4
            block  ;; label = @5
              local.get 0
              i32.const 65583
              i32.add
              local.tee 2
              i32.const -65536
              i32.and
              local.tee 6
              br_if 0 (;@5;)
              memory.size
              local.set 2
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 6
              i32.const -1
              i32.le_s
              br_if 0 (;@5;)
              local.get 2
              i32.const 16
              i32.shr_u
              memory.grow
              local.tee 2
              i32.const -1
              i32.ne
              br_if 1 (;@4;)
              i32.const 0
              i32.const 48
              i32.store offset=16799520
              block  ;; label = @6
                local.get 3
                i32.eqz
                br_if 0 (;@6;)
                local.get 3
                local.get 7
                i32.const 4
                i32.shl
                i32.const 16798352
                i32.add
                local.tee 2
                i32.eq
                br_if 0 (;@6;)
                loop  ;; label = @7
                  local.get 3
                  local.get 0
                  call $emmalloc_attempt_allocate
                  local.tee 1
                  br_if 6 (;@1;)
                  local.get 3
                  i32.load offset=8
                  local.tee 3
                  local.get 2
                  i32.ne
                  br_if 0 (;@7;)
                end
              end
              i32.const 0
              return
            end
            unreachable
            unreachable
          end
          local.get 2
          i32.const 16
          i32.shl
          local.tee 2
          local.get 6
          i32.add
          local.set 6
        end
        local.get 6
        i32.const -4
        i32.add
        i32.const 16
        i32.store
        local.get 6
        i32.const -16
        i32.add
        local.tee 1
        i32.const 16
        i32.store
        i32.const 0
        local.set 3
        block  ;; label = @3
          i32.const 0
          i32.load offset=16799504
          local.tee 7
          i32.eqz
          br_if 0 (;@3;)
          local.get 7
          i32.load offset=8
          local.set 3
        end
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              local.get 2
              local.get 3
              i32.ne
              br_if 0 (;@5;)
              local.get 2
              local.get 2
              i32.const -4
              i32.add
              i32.load
              i32.const -2
              i32.and
              i32.sub
              local.tee 3
              i32.const -4
              i32.add
              i32.load
              local.set 8
              local.get 7
              local.get 6
              i32.store offset=8
              block  ;; label = @6
                local.get 3
                local.get 8
                i32.const -2
                i32.and
                i32.sub
                local.tee 3
                local.get 3
                i32.load
                i32.add
                i32.const -4
                i32.add
                i32.load8_u
                i32.const 1
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 3
                i32.load offset=4
                local.get 3
                i32.load offset=8
                local.tee 2
                i32.store offset=8
                local.get 2
                local.get 3
                i32.load offset=4
                i32.store offset=4
                local.get 3
                local.get 1
                local.get 3
                i32.sub
                local.tee 2
                i32.store
                local.get 3
                local.get 2
                i32.const -4
                i32.and
                i32.add
                i32.const -4
                i32.add
                local.get 2
                i32.const 1
                i32.or
                i32.store
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 3
                    i32.load
                    i32.const -8
                    i32.add
                    local.tee 2
                    i32.const 127
                    i32.gt_u
                    br_if 0 (;@8;)
                    local.get 2
                    i32.const 3
                    i32.shr_u
                    i32.const -1
                    i32.add
                    local.set 2
                    br 1 (;@7;)
                  end
                  local.get 2
                  i32.clz
                  local.set 6
                  block  ;; label = @8
                    local.get 2
                    i32.const 4095
                    i32.gt_u
                    br_if 0 (;@8;)
                    local.get 2
                    i32.const 29
                    local.get 6
                    i32.sub
                    i32.shr_u
                    i32.const 4
                    i32.xor
                    local.get 6
                    i32.const 2
                    i32.shl
                    i32.sub
                    i32.const 110
                    i32.add
                    local.set 2
                    br 1 (;@7;)
                  end
                  local.get 2
                  i32.const 30
                  local.get 6
                  i32.sub
                  i32.shr_u
                  i32.const 2
                  i32.xor
                  local.get 6
                  i32.const 1
                  i32.shl
                  i32.sub
                  i32.const 71
                  i32.add
                  local.tee 2
                  i32.const 63
                  local.get 2
                  i32.const 63
                  i32.lt_u
                  select
                  local.set 2
                end
                local.get 3
                local.get 2
                i32.const 4
                i32.shl
                local.tee 6
                i32.const 16798352
                i32.add
                i32.store offset=4
                local.get 3
                local.get 6
                i32.const 16798360
                i32.add
                local.tee 6
                i32.load
                i32.store offset=8
                local.get 6
                local.get 3
                i32.store
                br 3 (;@3;)
              end
              local.get 2
              i32.const -16
              i32.add
              local.set 3
              br 1 (;@4;)
            end
            local.get 2
            i32.const 16
            i32.store
            local.get 2
            i32.const 12
            i32.add
            i32.const 16
            i32.store
            local.get 2
            local.get 6
            i32.store offset=8
            local.get 2
            local.get 7
            i32.store offset=4
            i32.const 0
            local.get 2
            i32.store offset=16799504
            local.get 2
            i32.const 16
            i32.add
            local.set 3
          end
          local.get 3
          local.get 1
          local.get 3
          i32.sub
          local.tee 2
          i32.store
          local.get 3
          local.get 2
          i32.const -4
          i32.and
          i32.add
          i32.const -4
          i32.add
          local.get 2
          i32.const 1
          i32.or
          i32.store
          block  ;; label = @4
            block  ;; label = @5
              local.get 3
              i32.load
              i32.const -8
              i32.add
              local.tee 2
              i32.const 127
              i32.gt_u
              br_if 0 (;@5;)
              local.get 2
              i32.const 3
              i32.shr_u
              i32.const -1
              i32.add
              local.set 2
              br 1 (;@4;)
            end
            local.get 2
            i32.clz
            local.set 6
            block  ;; label = @5
              local.get 2
              i32.const 4095
              i32.gt_u
              br_if 0 (;@5;)
              local.get 2
              i32.const 29
              local.get 6
              i32.sub
              i32.shr_u
              i32.const 4
              i32.xor
              local.get 6
              i32.const 2
              i32.shl
              i32.sub
              i32.const 110
              i32.add
              local.set 2
              br 1 (;@4;)
            end
            local.get 2
            i32.const 30
            local.get 6
            i32.sub
            i32.shr_u
            i32.const 2
            i32.xor
            local.get 6
            i32.const 1
            i32.shl
            i32.sub
            i32.const 71
            i32.add
            local.tee 2
            i32.const 63
            local.get 2
            i32.const 63
            i32.lt_u
            select
            local.set 2
          end
          local.get 3
          local.get 2
          i32.const 4
          i32.shl
          local.tee 6
          i32.const 16798352
          i32.add
          i32.store offset=4
          local.get 3
          local.get 6
          i32.const 16798360
          i32.add
          local.tee 6
          i32.load
          i32.store offset=8
          local.get 6
          local.get 3
          i32.store
        end
        local.get 3
        i32.load offset=8
        local.get 3
        i32.store offset=4
        i32.const 0
        local.set 1
        i32.const 0
        i32.const 0
        i64.load offset=16799496
        i64.const 1
        local.get 2
        i64.extend_i32_u
        i64.shl
        i64.or
        i64.store offset=16799496
        local.get 0
        i32.const -57
        i32.le_u
        br_if 0 (;@2;)
      end
    end
    local.get 1)
  (func $emmalloc_attempt_allocate (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32)
    i32.const 0
    local.set 2
    block  ;; label = @1
      local.get 0
      i32.const 19
      i32.add
      i32.const -16
      i32.and
      local.tee 3
      local.get 1
      i32.add
      local.get 0
      local.get 0
      i32.load
      i32.add
      i32.const -4
      i32.add
      i32.gt_u
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=4
      local.get 0
      i32.load offset=8
      local.tee 2
      i32.store offset=8
      local.get 2
      local.get 0
      i32.load offset=4
      i32.store offset=4
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.const 4
          i32.add
          local.tee 4
          local.get 3
          i32.ne
          br_if 0 (;@3;)
          local.get 0
          i32.load
          local.set 2
          br 1 (;@2;)
        end
        local.get 0
        i32.load
        local.set 5
        local.get 0
        local.get 0
        i32.const -4
        i32.add
        i32.load
        i32.const -2
        i32.and
        i32.sub
        local.tee 2
        local.get 2
        i32.load
        local.get 3
        local.get 4
        i32.sub
        local.tee 3
        i32.add
        local.tee 4
        i32.store
        local.get 2
        local.get 4
        i32.const -4
        i32.and
        i32.add
        i32.const -4
        i32.add
        local.get 4
        i32.store
        local.get 0
        local.get 3
        i32.add
        local.tee 0
        local.get 5
        local.get 3
        i32.sub
        local.tee 2
        i32.store
      end
      block  ;; label = @2
        block  ;; label = @3
          local.get 1
          i32.const 24
          i32.add
          local.get 2
          i32.gt_u
          br_if 0 (;@3;)
          local.get 0
          local.get 1
          i32.add
          i32.const 8
          i32.add
          local.tee 3
          local.get 2
          local.get 1
          i32.sub
          i32.const -8
          i32.add
          local.tee 2
          i32.store
          local.get 3
          local.get 2
          i32.const -4
          i32.and
          i32.add
          i32.const -4
          i32.add
          local.get 2
          i32.const 1
          i32.or
          i32.store
          block  ;; label = @4
            block  ;; label = @5
              local.get 3
              i32.load
              i32.const -8
              i32.add
              local.tee 2
              i32.const 127
              i32.gt_u
              br_if 0 (;@5;)
              local.get 2
              i32.const 3
              i32.shr_u
              i32.const -1
              i32.add
              local.set 2
              br 1 (;@4;)
            end
            local.get 2
            i32.clz
            local.set 4
            block  ;; label = @5
              local.get 2
              i32.const 4095
              i32.gt_u
              br_if 0 (;@5;)
              local.get 2
              i32.const 29
              local.get 4
              i32.sub
              i32.shr_u
              i32.const 4
              i32.xor
              local.get 4
              i32.const 2
              i32.shl
              i32.sub
              i32.const 110
              i32.add
              local.set 2
              br 1 (;@4;)
            end
            local.get 2
            i32.const 30
            local.get 4
            i32.sub
            i32.shr_u
            i32.const 2
            i32.xor
            local.get 4
            i32.const 1
            i32.shl
            i32.sub
            i32.const 71
            i32.add
            local.tee 2
            i32.const 63
            local.get 2
            i32.const 63
            i32.lt_u
            select
            local.set 2
          end
          local.get 3
          local.get 2
          i32.const 4
          i32.shl
          local.tee 4
          i32.const 16798352
          i32.add
          i32.store offset=4
          local.get 3
          local.get 4
          i32.const 16798360
          i32.add
          local.tee 4
          i32.load
          i32.store offset=8
          local.get 4
          local.get 3
          i32.store
          local.get 3
          i32.load offset=8
          local.get 3
          i32.store offset=4
          i32.const 0
          i32.const 0
          i64.load offset=16799496
          i64.const 1
          local.get 2
          i64.extend_i32_u
          i64.shl
          i64.or
          i64.store offset=16799496
          local.get 0
          local.get 1
          i32.const 8
          i32.add
          local.tee 2
          i32.store
          local.get 0
          local.get 2
          i32.const -4
          i32.and
          i32.add
          local.set 1
          br 1 (;@2;)
        end
        local.get 0
        local.get 2
        i32.add
        local.set 1
      end
      local.get 1
      i32.const -4
      i32.add
      local.get 2
      i32.store
      local.get 0
      i32.const 4
      i32.add
      local.set 2
    end
    local.get 2)
  (func $realloc (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 1
      call $emmalloc_memalign
      return
    end
    block  ;; label = @1
      local.get 1
      br_if 0 (;@1;)
      local.get 0
      call $free
      i32.const 0
      return
    end
    i32.const 0
    local.set 2
    block  ;; label = @1
      local.get 1
      i32.const -57
      i32.gt_u
      br_if 0 (;@1;)
      local.get 1
      i32.const 3
      i32.add
      i32.const -4
      i32.and
      i32.const 8
      local.get 1
      i32.const 8
      i32.gt_u
      select
      local.tee 3
      i32.const 8
      i32.add
      local.set 4
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.const -4
          i32.add
          local.tee 1
          local.get 1
          i32.load
          local.tee 5
          i32.add
          local.tee 6
          i32.load
          local.tee 7
          local.get 6
          local.get 7
          i32.add
          local.tee 7
          i32.const -4
          i32.add
          i32.load
          i32.eq
          br_if 0 (;@3;)
          block  ;; label = @4
            local.get 1
            local.get 4
            i32.add
            local.tee 5
            i32.const 16
            i32.add
            local.get 7
            i32.gt_u
            br_if 0 (;@4;)
            local.get 6
            i32.load offset=4
            local.get 6
            i32.load offset=8
            local.tee 2
            i32.store offset=8
            local.get 2
            local.get 6
            i32.load offset=4
            i32.store offset=4
            local.get 5
            local.get 7
            local.get 5
            i32.sub
            local.tee 2
            i32.store
            local.get 5
            local.get 2
            i32.const -4
            i32.and
            i32.add
            i32.const -4
            i32.add
            local.get 2
            i32.const 1
            i32.or
            i32.store
            block  ;; label = @5
              block  ;; label = @6
                local.get 5
                i32.load
                i32.const -8
                i32.add
                local.tee 2
                i32.const 127
                i32.gt_u
                br_if 0 (;@6;)
                local.get 2
                i32.const 3
                i32.shr_u
                i32.const -1
                i32.add
                local.set 2
                br 1 (;@5;)
              end
              local.get 2
              i32.clz
              local.set 6
              block  ;; label = @6
                local.get 2
                i32.const 4095
                i32.gt_u
                br_if 0 (;@6;)
                local.get 2
                i32.const 29
                local.get 6
                i32.sub
                i32.shr_u
                i32.const 4
                i32.xor
                local.get 6
                i32.const 2
                i32.shl
                i32.sub
                i32.const 110
                i32.add
                local.set 2
                br 1 (;@5;)
              end
              local.get 2
              i32.const 30
              local.get 6
              i32.sub
              i32.shr_u
              i32.const 2
              i32.xor
              local.get 6
              i32.const 1
              i32.shl
              i32.sub
              i32.const 71
              i32.add
              local.tee 2
              i32.const 63
              local.get 2
              i32.const 63
              i32.lt_u
              select
              local.set 2
            end
            local.get 5
            local.get 2
            i32.const 4
            i32.shl
            local.tee 6
            i32.const 16798352
            i32.add
            i32.store offset=4
            local.get 5
            local.get 6
            i32.const 16798360
            i32.add
            local.tee 6
            i32.load
            i32.store offset=8
            local.get 6
            local.get 5
            i32.store
            local.get 5
            i32.load offset=8
            local.get 5
            i32.store offset=4
            i32.const 0
            i32.const 0
            i64.load offset=16799496
            i64.const 1
            local.get 2
            i64.extend_i32_u
            i64.shl
            i64.or
            i64.store offset=16799496
            local.get 1
            local.get 4
            i32.store
            local.get 5
            i32.const -4
            i32.add
            local.get 4
            i32.store
            local.get 0
            return
          end
          local.get 5
          local.get 7
          i32.gt_u
          br_if 1 (;@2;)
          local.get 6
          i32.load offset=4
          local.get 6
          i32.load offset=8
          local.tee 2
          i32.store offset=8
          local.get 2
          local.get 6
          i32.load offset=4
          i32.store offset=4
          local.get 1
          local.get 6
          i32.load
          local.get 1
          i32.load
          i32.add
          local.tee 2
          i32.store
          local.get 1
          local.get 2
          i32.const -4
          i32.and
          i32.add
          i32.const -4
          i32.add
          local.get 2
          i32.store
          local.get 0
          return
        end
        block  ;; label = @3
          local.get 3
          i32.const 24
          i32.add
          local.get 5
          i32.gt_u
          br_if 0 (;@3;)
          local.get 1
          local.get 4
          i32.store
          local.get 1
          local.get 4
          i32.add
          local.tee 1
          local.get 5
          local.get 4
          i32.sub
          local.tee 2
          i32.store
          local.get 1
          i32.const -4
          i32.add
          local.tee 6
          local.get 4
          i32.store
          local.get 6
          local.get 2
          i32.const -4
          i32.and
          i32.add
          local.get 2
          i32.const 1
          i32.or
          i32.store
          block  ;; label = @4
            block  ;; label = @5
              local.get 1
              i32.load
              i32.const -8
              i32.add
              local.tee 2
              i32.const 127
              i32.gt_u
              br_if 0 (;@5;)
              local.get 2
              i32.const 3
              i32.shr_u
              i32.const -1
              i32.add
              local.set 2
              br 1 (;@4;)
            end
            local.get 2
            i32.clz
            local.set 4
            block  ;; label = @5
              local.get 2
              i32.const 4095
              i32.gt_u
              br_if 0 (;@5;)
              local.get 2
              i32.const 29
              local.get 4
              i32.sub
              i32.shr_u
              i32.const 4
              i32.xor
              local.get 4
              i32.const 2
              i32.shl
              i32.sub
              i32.const 110
              i32.add
              local.set 2
              br 1 (;@4;)
            end
            local.get 2
            i32.const 30
            local.get 4
            i32.sub
            i32.shr_u
            i32.const 2
            i32.xor
            local.get 4
            i32.const 1
            i32.shl
            i32.sub
            i32.const 71
            i32.add
            local.tee 2
            i32.const 63
            local.get 2
            i32.const 63
            i32.lt_u
            select
            local.set 2
          end
          local.get 1
          local.get 2
          i32.const 4
          i32.shl
          local.tee 4
          i32.const 16798352
          i32.add
          i32.store offset=4
          local.get 1
          local.get 4
          i32.const 16798360
          i32.add
          local.tee 4
          i32.load
          i32.store offset=8
          local.get 4
          local.get 1
          i32.store
          local.get 1
          i32.load offset=8
          local.get 1
          i32.store offset=4
          i32.const 0
          i32.const 0
          i64.load offset=16799496
          i64.const 1
          local.get 2
          i64.extend_i32_u
          i64.shl
          i64.or
          i64.store offset=16799496
          local.get 0
          return
        end
        local.get 5
        local.get 4
        i32.lt_u
        br_if 0 (;@2;)
        local.get 0
        return
      end
      local.get 3
      call $emmalloc_memalign
      local.tee 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 0
      local.get 3
      local.get 1
      i32.load
      i32.const -8
      i32.add
      local.tee 1
      local.get 3
      local.get 1
      i32.lt_u
      select
      call $memcpy
      local.set 1
      local.get 0
      call $free
      local.get 1
      local.set 2
    end
    local.get 2)
  (func $vorbis_synthesis_init (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 1
      i32.load offset=28
      local.tee 2
      br_if 0 (;@1;)
      i32.const 1
      return
    end
    i32.const 0
    local.set 3
    local.get 0
    i32.const 0
    i32.const 80
    call $memset
    local.set 4
    i32.const 1
    i32.const 24
    call $calloc
    local.set 5
    local.get 4
    local.get 1
    i32.store offset=4
    local.get 4
    local.get 5
    i32.store offset=72
    block  ;; label = @1
      local.get 2
      i32.load offset=8
      local.tee 0
      i32.const 2
      i32.lt_u
      br_if 0 (;@1;)
      local.get 0
      i32.const -1
      i32.add
      local.set 0
      i32.const 0
      local.set 3
      loop  ;; label = @2
        local.get 3
        i32.const 1
        i32.add
        local.set 3
        local.get 0
        i32.const 1
        i32.gt_u
        local.set 6
        local.get 0
        i32.const 1
        i32.shr_u
        local.set 0
        local.get 6
        br_if 0 (;@2;)
      end
    end
    local.get 5
    local.get 3
    i32.store offset=8
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                i32.load
                i32.const 2
                i32.div_s
                local.tee 0
                i32.const 511
                i32.gt_s
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 0
                  i32.const 127
                  i32.gt_s
                  br_if 0 (;@7;)
                  i32.const 16779312
                  local.set 3
                  local.get 0
                  i32.const 32
                  i32.eq
                  br_if 6 (;@1;)
                  local.get 0
                  i32.const 64
                  i32.ne
                  br_if 5 (;@2;)
                  i32.const 16779344
                  local.set 3
                  br 6 (;@1;)
                end
                local.get 0
                i32.const 128
                i32.eq
                br_if 1 (;@5;)
                local.get 0
                i32.const 256
                i32.ne
                br_if 4 (;@2;)
                i32.const 16779536
                local.set 3
                br 5 (;@1;)
              end
              block  ;; label = @6
                local.get 0
                i32.const 2047
                i32.gt_s
                br_if 0 (;@6;)
                local.get 0
                i32.const 512
                i32.eq
                br_if 2 (;@4;)
                local.get 0
                i32.const 1024
                i32.ne
                br_if 4 (;@2;)
                i32.const 16780304
                local.set 3
                br 5 (;@1;)
              end
              local.get 0
              i32.const 2048
              i32.eq
              br_if 2 (;@3;)
              local.get 0
              i32.const 4096
              i32.ne
              br_if 3 (;@2;)
              i32.const 16783376
              local.set 3
              br 4 (;@1;)
            end
            i32.const 16779408
            local.set 3
            br 3 (;@1;)
          end
          i32.const 16779792
          local.set 3
          br 2 (;@1;)
        end
        i32.const 16781328
        local.set 3
        br 1 (;@1;)
      end
      i32.const 0
      local.set 3
    end
    local.get 5
    local.get 3
    i32.store
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                i32.const 4
                i32.add
                i32.load
                i32.const 2
                i32.div_s
                local.tee 0
                i32.const 511
                i32.gt_s
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 0
                  i32.const 127
                  i32.gt_s
                  br_if 0 (;@7;)
                  i32.const 16779312
                  local.set 3
                  local.get 0
                  i32.const 32
                  i32.eq
                  br_if 6 (;@1;)
                  local.get 0
                  i32.const 64
                  i32.ne
                  br_if 5 (;@2;)
                  i32.const 16779344
                  local.set 3
                  br 6 (;@1;)
                end
                local.get 0
                i32.const 128
                i32.eq
                br_if 1 (;@5;)
                local.get 0
                i32.const 256
                i32.ne
                br_if 4 (;@2;)
                i32.const 16779536
                local.set 3
                br 5 (;@1;)
              end
              block  ;; label = @6
                local.get 0
                i32.const 2047
                i32.gt_s
                br_if 0 (;@6;)
                local.get 0
                i32.const 512
                i32.eq
                br_if 2 (;@4;)
                local.get 0
                i32.const 1024
                i32.ne
                br_if 4 (;@2;)
                i32.const 16780304
                local.set 3
                br 5 (;@1;)
              end
              local.get 0
              i32.const 2048
              i32.eq
              br_if 2 (;@3;)
              local.get 0
              i32.const 4096
              i32.ne
              br_if 3 (;@2;)
              i32.const 16783376
              local.set 3
              br 4 (;@1;)
            end
            i32.const 16779408
            local.set 3
            br 3 (;@1;)
          end
          i32.const 16779792
          local.set 3
          br 2 (;@1;)
        end
        i32.const 16781328
        local.set 3
        br 1 (;@1;)
      end
      i32.const 0
      local.set 3
    end
    local.get 5
    i32.const 4
    i32.add
    local.get 3
    i32.store
    block  ;; label = @1
      local.get 2
      i32.load offset=3104
      br_if 0 (;@1;)
      local.get 2
      local.get 2
      i32.load offset=28
      local.tee 6
      i32.const 52
      call $calloc
      i32.store offset=3104
      local.get 6
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 2
          i32.const 2080
          i32.add
          local.tee 0
          i32.load
          local.tee 7
          i32.eqz
          br_if 0 (;@3;)
          i32.const 0
          local.set 3
          i32.const 0
          local.set 8
          block  ;; label = @4
            loop  ;; label = @5
              block  ;; label = @6
                local.get 2
                i32.load offset=3104
                local.get 3
                i32.add
                local.get 7
                call $vorbis_book_init_decode
                i32.eqz
                br_if 0 (;@6;)
                local.get 2
                i32.load offset=28
                local.set 6
                br 2 (;@4;)
              end
              block  ;; label = @6
                local.get 0
                i32.load
                local.tee 6
                i32.load offset=32
                local.tee 7
                i32.eqz
                br_if 0 (;@6;)
                local.get 7
                call $free
              end
              block  ;; label = @6
                local.get 6
                i32.load offset=8
                local.tee 7
                i32.eqz
                br_if 0 (;@6;)
                local.get 7
                call $free
              end
              local.get 6
              call $free
              local.get 0
              i32.const 0
              i32.store
              local.get 8
              i32.const 1
              i32.add
              local.tee 8
              local.get 2
              i32.load offset=28
              local.tee 6
              i32.ge_s
              br_if 4 (;@1;)
              local.get 3
              i32.const 52
              i32.add
              local.set 3
              local.get 0
              i32.const 4
              i32.add
              local.set 7
              local.get 0
              i32.const 4
              i32.add
              local.set 0
              local.get 7
              i32.load
              local.tee 7
              br_if 0 (;@5;)
            end
          end
          local.get 6
          i32.const 1
          i32.lt_s
          br_if 1 (;@2;)
        end
        local.get 2
        i32.const 2080
        i32.add
        local.set 0
        i32.const 0
        local.set 5
        loop  ;; label = @3
          block  ;; label = @4
            local.get 0
            i32.load
            local.tee 3
            i32.eqz
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 3
              i32.load offset=32
              local.tee 6
              i32.eqz
              br_if 0 (;@5;)
              local.get 6
              call $free
            end
            block  ;; label = @5
              local.get 3
              i32.load offset=8
              local.tee 6
              i32.eqz
              br_if 0 (;@5;)
              local.get 6
              call $free
            end
            local.get 3
            call $free
            local.get 0
            i32.const 0
            i32.store
            local.get 2
            i32.load offset=28
            local.set 6
          end
          local.get 0
          i32.const 4
          i32.add
          local.set 0
          local.get 5
          i32.const 1
          i32.add
          local.tee 5
          local.get 6
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 4
      call $vorbis_dsp_clear
      i32.const 1
      return
    end
    local.get 4
    local.get 2
    i32.const 4
    i32.add
    i32.load
    local.tee 7
    i32.store offset=16
    local.get 4
    local.get 1
    i32.load offset=4
    local.tee 3
    i32.const 2
    i32.shl
    local.tee 0
    call $malloc
    i32.store offset=8
    local.get 4
    local.get 0
    call $malloc
    i32.store offset=12
    block  ;; label = @1
      local.get 3
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      i32.const 0
      local.set 0
      loop  ;; label = @2
        local.get 7
        i32.const 4
        call $calloc
        local.set 6
        local.get 4
        i32.load offset=8
        local.get 0
        i32.add
        local.get 6
        i32.store
        local.get 0
        i32.const 4
        i32.add
        local.set 0
        local.get 3
        i32.const -1
        i32.add
        local.tee 3
        br_if 0 (;@2;)
      end
    end
    local.get 4
    i64.const 0
    i64.store offset=36 align=4
    local.get 5
    local.get 2
    i32.load offset=8
    local.tee 0
    i32.const 4
    call $calloc
    i32.store offset=12
    block  ;; label = @1
      local.get 0
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 2
      i32.const 32
      i32.add
      local.set 7
      i32.const 0
      local.set 0
      i32.const 0
      local.set 3
      loop  ;; label = @2
        local.get 4
        local.get 7
        local.get 0
        i32.add
        i32.load
        local.tee 6
        local.get 2
        local.get 6
        i32.load offset=12
        i32.const 2
        i32.shl
        i32.add
        i32.const 544
        i32.add
        i32.load
        call $mapping0_look
        local.set 6
        local.get 5
        i32.load offset=12
        local.get 0
        i32.add
        local.get 6
        i32.store
        local.get 0
        i32.const 4
        i32.add
        local.set 0
        local.get 3
        i32.const 1
        i32.add
        local.tee 3
        local.get 2
        i32.load offset=8
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 4
      i32.load offset=72
      local.tee 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      i32.load offset=4
      local.tee 2
      i32.eqz
      br_if 0 (;@1;)
      local.get 2
      i32.load offset=28
      local.tee 2
      i32.eqz
      br_if 0 (;@1;)
      local.get 2
      i32.const 4
      i32.add
      i32.load
      local.set 2
      local.get 4
      i64.const -1
      i64.store offset=56
      local.get 4
      i32.const 64
      i32.add
      i64.const -1
      i64.store
      local.get 4
      i32.const -1
      i32.store offset=24
      local.get 4
      local.get 2
      i32.const 2
      i32.div_s
      local.tee 2
      i32.store offset=20
      local.get 4
      local.get 2
      i32.store offset=48
      local.get 0
      i64.const -1
      i64.store offset=16
    end
    i32.const 0)
  (func $vorbis_book_init_decode (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 144
    i32.sub
    local.tee 2
    local.set 3
    local.get 2
    global.set $__stack_pointer
    local.get 0
    i64.const 0
    i64.store align=4
    i32.const 0
    local.set 4
    local.get 0
    i32.const 48
    i32.add
    i32.const 0
    i32.store
    local.get 0
    i32.const 40
    i32.add
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 32
    i32.add
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 24
    i32.add
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 16
    i32.add
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 8
    i32.add
    i64.const 0
    i64.store align=4
    block  ;; label = @1
      block  ;; label = @2
        local.get 1
        i32.load offset=4
        local.tee 5
        i32.const 0
        i32.gt_s
        br_if 0 (;@2;)
        local.get 0
        i32.const 0
        i32.store offset=8
        local.get 0
        local.get 5
        i32.store offset=4
        local.get 0
        local.get 1
        i32.load
        i32.store
        br 1 (;@1;)
      end
      local.get 5
      i32.const 3
      i32.and
      local.set 6
      local.get 1
      i32.load offset=8
      local.set 7
      block  ;; label = @2
        block  ;; label = @3
          local.get 5
          i32.const 4
          i32.ge_u
          br_if 0 (;@3;)
          i32.const 0
          local.set 8
          i32.const 0
          local.set 9
          br 1 (;@2;)
        end
        local.get 7
        local.set 4
        local.get 5
        i32.const 2147483644
        i32.and
        local.tee 8
        local.set 10
        i32.const 0
        local.set 9
        loop  ;; label = @3
          local.get 9
          local.get 4
          i32.load
          i32.const 0
          i32.gt_s
          i32.add
          local.get 4
          i32.const 4
          i32.add
          i32.load
          i32.const 0
          i32.gt_s
          i32.add
          local.get 4
          i32.const 8
          i32.add
          i32.load
          i32.const 0
          i32.gt_s
          i32.add
          local.get 4
          i32.const 12
          i32.add
          i32.load
          i32.const 0
          i32.gt_s
          i32.add
          local.set 9
          local.get 4
          i32.const 16
          i32.add
          local.set 4
          local.get 10
          i32.const -4
          i32.add
          local.tee 10
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 6
        i32.eqz
        br_if 0 (;@2;)
        local.get 7
        local.get 8
        i32.const 2
        i32.shl
        i32.add
        local.set 4
        loop  ;; label = @3
          local.get 9
          local.get 4
          i32.load
          i32.const 0
          i32.gt_s
          i32.add
          local.set 9
          local.get 4
          i32.const 4
          i32.add
          local.set 4
          local.get 6
          i32.const -1
          i32.add
          local.tee 6
          br_if 0 (;@3;)
        end
      end
      local.get 0
      local.get 9
      i32.store offset=8
      local.get 0
      local.get 5
      i32.store offset=4
      local.get 0
      local.get 1
      i32.load
      i32.store
      block  ;; label = @2
        block  ;; label = @3
          local.get 9
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 11
          local.get 9
          i32.const 2
          i32.shl
          local.tee 12
          call $malloc
          local.set 13
          local.get 3
          i32.const 0
          i32.const 132
          call $memset
          local.set 14
          i32.const 0
          local.set 15
          block  ;; label = @4
            block  ;; label = @5
              loop  ;; label = @6
                i32.const 0
                local.set 6
                block  ;; label = @7
                  local.get 7
                  local.get 11
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  local.tee 16
                  i32.const 1
                  i32.lt_s
                  br_if 0 (;@7;)
                  local.get 14
                  local.get 16
                  i32.const 2
                  i32.shl
                  i32.add
                  local.tee 8
                  i32.load
                  local.set 17
                  block  ;; label = @8
                    local.get 16
                    i32.const 31
                    i32.gt_u
                    br_if 0 (;@8;)
                    local.get 17
                    local.get 16
                    i32.shr_u
                    br_if 3 (;@5;)
                  end
                  local.get 13
                  local.get 15
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get 17
                  i32.store
                  local.get 8
                  local.set 4
                  local.get 16
                  local.set 6
                  block  ;; label = @8
                    loop  ;; label = @9
                      block  ;; label = @10
                        local.get 4
                        i32.load
                        local.tee 10
                        i32.const 1
                        i32.and
                        i32.eqz
                        br_if 0 (;@10;)
                        block  ;; label = @11
                          local.get 6
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 14
                          local.get 14
                          i32.load offset=4
                          i32.const 1
                          i32.add
                          i32.store offset=4
                          br 3 (;@8;)
                        end
                        local.get 4
                        local.get 6
                        i32.const 2
                        i32.shl
                        local.get 14
                        i32.add
                        i32.const -4
                        i32.add
                        i32.load
                        i32.const 1
                        i32.shl
                        i32.store
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 10
                      i32.const 1
                      i32.or
                      i32.store
                      local.get 4
                      i32.const -4
                      i32.add
                      local.set 4
                      local.get 6
                      i32.const 1
                      i32.gt_s
                      local.set 10
                      local.get 6
                      i32.const -1
                      i32.add
                      local.set 6
                      local.get 10
                      br_if 0 (;@9;)
                    end
                  end
                  i32.const 1
                  local.set 6
                  local.get 16
                  i32.const 1
                  i32.add
                  i32.const 32
                  i32.gt_s
                  br_if 0 (;@7;)
                  local.get 16
                  i32.const -32
                  i32.add
                  local.set 10
                  loop  ;; label = @8
                    i32.const 1
                    local.set 6
                    local.get 8
                    i32.const 4
                    i32.add
                    local.tee 4
                    i32.load
                    local.tee 16
                    i32.const 1
                    i32.shr_u
                    local.get 17
                    i32.ne
                    br_if 1 (;@7;)
                    i32.const 1
                    local.set 6
                    local.get 4
                    local.get 8
                    i32.load
                    i32.const 1
                    i32.shl
                    i32.store
                    local.get 4
                    local.set 8
                    local.get 16
                    local.set 17
                    local.get 10
                    i32.const 1
                    i32.add
                    local.tee 10
                    br_if 0 (;@8;)
                  end
                end
                local.get 15
                local.get 6
                i32.add
                local.set 15
                local.get 11
                i32.const 1
                i32.add
                local.tee 11
                local.get 5
                i32.ne
                br_if 0 (;@6;)
              end
              local.get 9
              i32.const 1
              i32.eq
              br_if 1 (;@4;)
              local.get 14
              i32.const 8
              i32.or
              local.set 4
              i32.const 30
              local.set 6
              loop  ;; label = @6
                local.get 4
                i32.const -4
                i32.add
                i32.load
                local.get 6
                i32.const 1
                i32.add
                i32.shl
                br_if 1 (;@5;)
                local.get 4
                i32.load
                local.get 6
                i32.shl
                br_if 1 (;@5;)
                local.get 4
                i32.const 8
                i32.add
                local.set 4
                local.get 6
                i32.const -2
                i32.add
                local.tee 6
                i32.const -2
                i32.eq
                br_if 2 (;@4;)
                br 0 (;@6;)
              end
            end
            local.get 13
            call $free
            br 2 (;@2;)
          end
          i32.const 0
          local.set 11
          i32.const 0
          local.set 15
          loop  ;; label = @4
            i32.const 0
            local.set 8
            block  ;; label = @5
              local.get 7
              local.get 11
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.tee 16
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 16
              i32.const 3
              i32.and
              local.set 17
              local.get 13
              local.get 15
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.set 6
              i32.const 0
              local.set 8
              i32.const 0
              local.set 10
              block  ;; label = @6
                local.get 16
                i32.const 4
                i32.lt_u
                br_if 0 (;@6;)
                local.get 16
                i32.const 2147483644
                i32.and
                local.set 10
                i32.const 0
                local.set 8
                i32.const 0
                local.set 4
                loop  ;; label = @7
                  local.get 6
                  local.get 4
                  i32.const 3
                  i32.add
                  i32.shr_u
                  i32.const 1
                  i32.and
                  local.get 6
                  local.get 4
                  i32.const 1
                  i32.add
                  i32.shr_u
                  i32.const 1
                  i32.and
                  local.get 8
                  i32.const 2
                  i32.shl
                  local.get 6
                  local.get 4
                  i32.shr_u
                  i32.const 1
                  i32.shl
                  i32.const 2
                  i32.and
                  i32.or
                  i32.or
                  i32.const 2
                  i32.shl
                  local.get 6
                  local.get 4
                  i32.const 2
                  i32.add
                  i32.shr_u
                  i32.const 1
                  i32.shl
                  i32.const 2
                  i32.and
                  i32.or
                  i32.or
                  local.set 8
                  local.get 4
                  i32.const 4
                  i32.add
                  local.tee 4
                  local.get 10
                  i32.ne
                  br_if 0 (;@7;)
                end
              end
              local.get 17
              i32.eqz
              br_if 0 (;@5;)
              loop  ;; label = @6
                local.get 6
                local.get 10
                i32.shr_u
                i32.const 1
                i32.and
                local.get 8
                i32.const 1
                i32.shl
                i32.or
                local.set 8
                local.get 10
                i32.const 1
                i32.add
                local.set 10
                local.get 17
                i32.const -1
                i32.add
                local.tee 17
                br_if 0 (;@6;)
              end
            end
            block  ;; label = @5
              local.get 16
              i32.eqz
              br_if 0 (;@5;)
              local.get 13
              local.get 15
              i32.const 2
              i32.shl
              i32.add
              local.get 8
              i32.store
              local.get 15
              i32.const 1
              i32.add
              local.set 15
            end
            local.get 11
            i32.const 1
            i32.add
            local.tee 11
            local.get 5
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 2
          local.get 12
          i32.const 15
          i32.add
          i32.const -16
          i32.and
          i32.sub
          local.tee 5
          local.tee 14
          global.set $__stack_pointer
          local.get 13
          i32.eqz
          br_if 1 (;@2;)
          local.get 9
          i32.const 3
          i32.and
          local.set 11
          i32.const 0
          local.set 15
          block  ;; label = @4
            local.get 9
            i32.const 4
            i32.lt_u
            br_if 0 (;@4;)
            local.get 9
            i32.const 2147483644
            i32.and
            local.set 7
            i32.const 0
            local.set 6
            i32.const 0
            local.set 15
            loop  ;; label = @5
              local.get 5
              local.get 6
              i32.add
              local.tee 10
              local.get 13
              local.get 6
              i32.add
              local.tee 4
              i32.store
              local.get 10
              i32.const 4
              i32.add
              local.get 4
              i32.const 4
              i32.add
              local.tee 8
              i32.store
              local.get 10
              i32.const 8
              i32.add
              local.get 4
              i32.const 8
              i32.add
              local.tee 17
              i32.store
              local.get 10
              i32.const 12
              i32.add
              local.get 4
              i32.const 12
              i32.add
              local.tee 16
              i32.store
              local.get 4
              local.get 4
              i32.load
              local.tee 10
              i32.const 24
              i32.shl
              local.get 10
              i32.const 65280
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.get 10
              i32.const 8
              i32.shr_u
              i32.const 65280
              i32.and
              local.get 10
              i32.const 24
              i32.shr_u
              i32.or
              i32.or
              local.tee 10
              i32.const 4
              i32.shr_u
              i32.const 252645135
              i32.and
              local.get 10
              i32.const 252645135
              i32.and
              i32.const 4
              i32.shl
              i32.or
              local.tee 10
              i32.const 2
              i32.shr_u
              i32.const 858993459
              i32.and
              local.get 10
              i32.const 858993459
              i32.and
              i32.const 2
              i32.shl
              i32.or
              local.tee 10
              i32.const 1
              i32.shr_u
              i32.const 1431655765
              i32.and
              local.get 10
              i32.const 1431655765
              i32.and
              i32.const 1
              i32.shl
              i32.or
              i32.store
              local.get 8
              local.get 8
              i32.load
              local.tee 4
              i32.const 24
              i32.shl
              local.get 4
              i32.const 65280
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.get 4
              i32.const 8
              i32.shr_u
              i32.const 65280
              i32.and
              local.get 4
              i32.const 24
              i32.shr_u
              i32.or
              i32.or
              local.tee 4
              i32.const 4
              i32.shr_u
              i32.const 252645135
              i32.and
              local.get 4
              i32.const 252645135
              i32.and
              i32.const 4
              i32.shl
              i32.or
              local.tee 4
              i32.const 2
              i32.shr_u
              i32.const 858993459
              i32.and
              local.get 4
              i32.const 858993459
              i32.and
              i32.const 2
              i32.shl
              i32.or
              local.tee 4
              i32.const 1
              i32.shr_u
              i32.const 1431655765
              i32.and
              local.get 4
              i32.const 1431655765
              i32.and
              i32.const 1
              i32.shl
              i32.or
              i32.store
              local.get 17
              local.get 17
              i32.load
              local.tee 4
              i32.const 24
              i32.shl
              local.get 4
              i32.const 65280
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.get 4
              i32.const 8
              i32.shr_u
              i32.const 65280
              i32.and
              local.get 4
              i32.const 24
              i32.shr_u
              i32.or
              i32.or
              local.tee 4
              i32.const 4
              i32.shr_u
              i32.const 252645135
              i32.and
              local.get 4
              i32.const 252645135
              i32.and
              i32.const 4
              i32.shl
              i32.or
              local.tee 4
              i32.const 2
              i32.shr_u
              i32.const 858993459
              i32.and
              local.get 4
              i32.const 858993459
              i32.and
              i32.const 2
              i32.shl
              i32.or
              local.tee 4
              i32.const 1
              i32.shr_u
              i32.const 1431655765
              i32.and
              local.get 4
              i32.const 1431655765
              i32.and
              i32.const 1
              i32.shl
              i32.or
              i32.store
              local.get 16
              local.get 16
              i32.load
              local.tee 4
              i32.const 24
              i32.shl
              local.get 4
              i32.const 65280
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.get 4
              i32.const 8
              i32.shr_u
              i32.const 65280
              i32.and
              local.get 4
              i32.const 24
              i32.shr_u
              i32.or
              i32.or
              local.tee 4
              i32.const 4
              i32.shr_u
              i32.const 252645135
              i32.and
              local.get 4
              i32.const 252645135
              i32.and
              i32.const 4
              i32.shl
              i32.or
              local.tee 4
              i32.const 2
              i32.shr_u
              i32.const 858993459
              i32.and
              local.get 4
              i32.const 858993459
              i32.and
              i32.const 2
              i32.shl
              i32.or
              local.tee 4
              i32.const 1
              i32.shr_u
              i32.const 1431655765
              i32.and
              local.get 4
              i32.const 1431655765
              i32.and
              i32.const 1
              i32.shl
              i32.or
              i32.store
              local.get 6
              i32.const 16
              i32.add
              local.set 6
              local.get 7
              local.get 15
              i32.const 4
              i32.add
              local.tee 15
              i32.ne
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 11
            i32.eqz
            br_if 0 (;@4;)
            local.get 13
            local.get 15
            i32.const 2
            i32.shl
            local.tee 6
            i32.add
            local.set 4
            local.get 5
            local.get 6
            i32.add
            local.set 10
            loop  ;; label = @5
              local.get 10
              local.get 4
              i32.store
              local.get 4
              local.get 4
              i32.load
              local.tee 6
              i32.const 24
              i32.shl
              local.get 6
              i32.const 65280
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.get 6
              i32.const 8
              i32.shr_u
              i32.const 65280
              i32.and
              local.get 6
              i32.const 24
              i32.shr_u
              i32.or
              i32.or
              local.tee 6
              i32.const 4
              i32.shr_u
              i32.const 252645135
              i32.and
              local.get 6
              i32.const 252645135
              i32.and
              i32.const 4
              i32.shl
              i32.or
              local.tee 6
              i32.const 2
              i32.shr_u
              i32.const 858993459
              i32.and
              local.get 6
              i32.const 858993459
              i32.and
              i32.const 2
              i32.shl
              i32.or
              local.tee 6
              i32.const 1
              i32.shr_u
              i32.const 1431655765
              i32.and
              local.get 6
              i32.const 1431655765
              i32.and
              i32.const 1
              i32.shl
              i32.or
              i32.store
              local.get 4
              i32.const 4
              i32.add
              local.set 4
              local.get 10
              i32.const 4
              i32.add
              local.set 10
              local.get 11
              i32.const -1
              i32.add
              local.tee 11
              br_if 0 (;@5;)
            end
          end
          local.get 5
          local.get 9
          i32.const 3
          call $qsort
          local.get 14
          local.get 12
          i32.const 15
          i32.add
          i32.const -16
          i32.and
          i32.sub
          local.tee 15
          global.set $__stack_pointer
          local.get 0
          local.get 12
          call $malloc
          local.tee 10
          i32.store offset=20
          local.get 9
          i32.const 1
          local.get 9
          i32.const 1
          i32.gt_s
          select
          local.tee 11
          i32.const 3
          i32.and
          local.set 17
          i32.const 0
          local.set 4
          block  ;; label = @4
            local.get 9
            i32.const 4
            i32.lt_s
            br_if 0 (;@4;)
            local.get 11
            i32.const 2147483644
            i32.and
            local.set 8
            i32.const 0
            local.set 4
            local.get 5
            local.set 6
            loop  ;; label = @5
              local.get 15
              local.get 6
              i32.load
              local.get 13
              i32.sub
              i32.add
              local.get 4
              i32.store
              local.get 15
              local.get 6
              i32.const 4
              i32.add
              i32.load
              local.get 13
              i32.sub
              i32.add
              local.get 4
              i32.const 1
              i32.add
              i32.store
              local.get 15
              local.get 6
              i32.const 8
              i32.add
              i32.load
              local.get 13
              i32.sub
              i32.add
              local.get 4
              i32.const 2
              i32.add
              i32.store
              local.get 15
              local.get 6
              i32.const 12
              i32.add
              i32.load
              local.get 13
              i32.sub
              i32.add
              local.get 4
              i32.const 3
              i32.add
              i32.store
              local.get 6
              i32.const 16
              i32.add
              local.set 6
              local.get 4
              i32.const 4
              i32.add
              local.tee 4
              local.get 8
              i32.ne
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 17
            i32.eqz
            br_if 0 (;@4;)
            local.get 5
            local.get 4
            i32.const 2
            i32.shl
            i32.add
            local.set 6
            local.get 17
            local.set 8
            loop  ;; label = @5
              local.get 15
              local.get 6
              i32.load
              local.get 13
              i32.sub
              i32.add
              local.get 4
              i32.store
              local.get 6
              i32.const 4
              i32.add
              local.set 6
              local.get 4
              i32.const 1
              i32.add
              local.set 4
              local.get 8
              i32.const -1
              i32.add
              local.tee 8
              br_if 0 (;@5;)
            end
          end
          i32.const 0
          local.set 16
          block  ;; label = @4
            local.get 9
            i32.const 4
            i32.lt_s
            br_if 0 (;@4;)
            local.get 11
            i32.const 2147483644
            i32.and
            local.set 11
            i32.const 0
            local.set 4
            i32.const 0
            local.set 16
            loop  ;; label = @5
              local.get 10
              local.get 15
              local.get 4
              i32.add
              local.tee 6
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.get 13
              local.get 4
              i32.add
              local.tee 8
              i32.load
              i32.store
              local.get 10
              local.get 6
              i32.const 4
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.get 8
              i32.const 4
              i32.add
              i32.load
              i32.store
              local.get 10
              local.get 6
              i32.const 8
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.get 8
              i32.const 8
              i32.add
              i32.load
              i32.store
              local.get 10
              local.get 6
              i32.const 12
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.get 8
              i32.const 12
              i32.add
              i32.load
              i32.store
              local.get 4
              i32.const 16
              i32.add
              local.set 4
              local.get 11
              local.get 16
              i32.const 4
              i32.add
              local.tee 16
              i32.ne
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 17
            i32.eqz
            br_if 0 (;@4;)
            local.get 13
            local.get 16
            i32.const 2
            i32.shl
            local.tee 6
            i32.add
            local.set 4
            local.get 15
            local.get 6
            i32.add
            local.set 6
            loop  ;; label = @5
              local.get 10
              local.get 6
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.get 4
              i32.load
              i32.store
              local.get 4
              i32.const 4
              i32.add
              local.set 4
              local.get 6
              i32.const 4
              i32.add
              local.set 6
              local.get 17
              i32.const -1
              i32.add
              local.tee 17
              br_if 0 (;@5;)
            end
          end
          local.get 13
          call $free
          i32.const 0
          local.set 18
          block  ;; label = @4
            local.get 1
            i32.load offset=12
            i32.const -1
            i32.add
            i32.const 1
            i32.gt_u
            br_if 0 (;@4;)
            i32.const -9999
            local.set 19
            i32.const 0
            local.set 2
            i32.const 0
            local.set 16
            i32.const -9999
            local.set 7
            block  ;; label = @5
              local.get 1
              i32.load offset=16
              local.tee 4
              i32.const 2097151
              i32.and
              local.tee 6
              i32.eqz
              br_if 0 (;@5;)
              i32.const 0
              local.get 6
              i32.const 30
              local.get 6
              i32.clz
              local.tee 10
              i32.const 31
              i32.xor
              i32.sub
              i32.shl
              local.tee 6
              i32.sub
              local.get 6
              local.get 4
              i32.const 0
              i32.lt_s
              select
              local.set 16
              local.get 4
              i32.const 21
              i32.shr_u
              i32.const 1023
              i32.and
              local.get 10
              i32.sub
              i32.const -787
              i32.add
              local.set 7
            end
            block  ;; label = @5
              local.get 1
              i32.load offset=20
              local.tee 4
              i32.const 2097151
              i32.and
              local.tee 6
              i32.eqz
              br_if 0 (;@5;)
              i32.const 0
              local.get 6
              i32.const 30
              local.get 6
              i32.clz
              local.tee 10
              i32.const 31
              i32.xor
              i32.sub
              i32.shl
              local.tee 6
              i32.sub
              local.get 6
              local.get 4
              i32.const 0
              i32.lt_s
              select
              local.set 2
              local.get 4
              i32.const 21
              i32.shr_u
              i32.const 1023
              i32.and
              local.get 10
              i32.sub
              i32.const -787
              i32.add
              local.set 19
            end
            local.get 1
            i32.load
            local.tee 14
            local.get 9
            i32.mul
            local.tee 20
            i32.const 4
            call $calloc
            local.set 18
            local.get 20
            i32.const 4
            call $calloc
            local.set 21
            local.get 0
            local.get 7
            i32.store offset=12
            local.get 7
            local.set 11
            block  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 1
                    i32.load offset=12
                    i32.const -1
                    i32.add
                    br_table 1 (;@7;) 0 (;@8;) 3 (;@5;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 22
                  i32.const 1
                  i32.ge_s
                  br_if 1 (;@6;)
                  local.get 7
                  local.set 11
                  br 2 (;@5;)
                end
                block  ;; label = @7
                  local.get 1
                  i32.load offset=4
                  local.tee 23
                  br_if 0 (;@7;)
                  local.get 7
                  local.set 11
                  br 2 (;@5;)
                end
                i32.const -1
                local.set 6
                local.get 23
                local.set 4
                loop  ;; label = @7
                  local.get 6
                  i32.const 1
                  i32.add
                  local.set 6
                  local.get 4
                  i32.const 1
                  i32.gt_u
                  local.set 10
                  local.get 4
                  i32.const 1
                  i32.shr_u
                  local.set 4
                  local.get 10
                  br_if 0 (;@7;)
                end
                block  ;; label = @7
                  local.get 23
                  i32.const 1
                  i32.ge_s
                  br_if 0 (;@7;)
                  local.get 7
                  local.set 11
                  br 2 (;@5;)
                end
                local.get 23
                local.get 6
                local.get 14
                i32.const -1
                i32.add
                i32.mul
                local.get 14
                i32.div_s
                i32.shr_u
                local.set 17
                loop  ;; label = @7
                  i32.const 1
                  local.set 4
                  i32.const 1
                  local.set 6
                  block  ;; label = @8
                    local.get 14
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    i32.const 1
                    local.set 6
                    local.get 17
                    i32.const 1
                    i32.add
                    local.set 10
                    local.get 23
                    local.get 17
                    i32.div_s
                    local.set 9
                    local.get 14
                    local.set 8
                    i32.const 1
                    local.set 4
                    loop  ;; label = @9
                      block  ;; label = @10
                        local.get 9
                        local.get 4
                        i32.ge_s
                        br_if 0 (;@10;)
                        i32.const -1
                        local.get 17
                        i32.add
                        local.set 17
                        br 3 (;@7;)
                      end
                      i32.const 2147483647
                      local.get 6
                      local.get 10
                      i32.mul
                      i32.const 2147483647
                      local.get 10
                      i32.div_s
                      local.get 6
                      i32.lt_s
                      select
                      local.set 6
                      local.get 4
                      local.get 17
                      i32.mul
                      local.set 4
                      local.get 8
                      i32.const -1
                      i32.add
                      local.tee 8
                      br_if 0 (;@9;)
                    end
                  end
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 4
                      local.get 23
                      i32.gt_s
                      local.tee 4
                      br_if 0 (;@9;)
                      local.get 6
                      local.get 23
                      i32.gt_s
                      br_if 1 (;@8;)
                    end
                    i32.const -1
                    i32.const 1
                    local.get 4
                    select
                    local.get 17
                    i32.add
                    local.set 17
                    br 1 (;@7;)
                  end
                end
                local.get 16
                i32.const 1
                i32.shr_s
                local.set 24
                local.get 2
                i32.const 15
                i32.shr_s
                local.set 25
                local.get 1
                i32.load offset=8
                local.set 26
                local.get 7
                local.set 11
                i32.const 0
                local.set 27
                i32.const 0
                local.set 22
                loop  ;; label = @7
                  block  ;; label = @8
                    local.get 26
                    local.get 27
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    i32.eqz
                    br_if 0 (;@8;)
                    block  ;; label = @9
                      local.get 14
                      i32.const 1
                      i32.lt_s
                      br_if 0 (;@9;)
                      local.get 21
                      local.get 15
                      local.get 22
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      local.get 14
                      i32.mul
                      i32.const 2
                      i32.shl
                      local.tee 4
                      i32.add
                      local.set 28
                      local.get 18
                      local.get 4
                      i32.add
                      local.set 29
                      local.get 1
                      i32.load offset=32
                      local.set 30
                      i32.const 0
                      local.set 9
                      i32.const 1
                      local.set 13
                      i32.const 0
                      local.set 8
                      i32.const 0
                      local.set 5
                      loop  ;; label = @10
                        local.get 30
                        local.get 27
                        local.get 13
                        i32.div_s
                        local.get 17
                        i32.rem_s
                        i32.const 2
                        i32.shl
                        i32.add
                        i32.load
                        local.tee 4
                        local.get 4
                        i32.const 31
                        i32.shr_s
                        local.tee 6
                        i32.xor
                        local.get 6
                        i32.sub
                        local.set 31
                        i32.const 0
                        local.set 6
                        block  ;; label = @11
                          local.get 4
                          i32.eqz
                          br_if 0 (;@11;)
                          i32.const 0
                          local.set 6
                          local.get 31
                          local.set 4
                          loop  ;; label = @12
                            local.get 6
                            i32.const 1
                            i32.add
                            local.set 6
                            local.get 4
                            i32.const 1
                            i32.gt_u
                            local.set 10
                            local.get 4
                            i32.const 1
                            i32.shr_u
                            local.set 4
                            local.get 10
                            br_if 0 (;@12;)
                          end
                        end
                        block  ;; label = @11
                          block  ;; label = @12
                            block  ;; label = @13
                              local.get 2
                              i32.eqz
                              br_if 0 (;@13;)
                              local.get 31
                              i32.const 31
                              local.get 6
                              i32.sub
                              i32.shl
                              local.tee 10
                              i32.eqz
                              br_if 0 (;@13;)
                              local.get 6
                              local.get 19
                              i32.add
                              local.set 4
                              local.get 10
                              i32.const 16
                              i32.shr_s
                              local.get 25
                              i32.mul
                              local.set 6
                              block  ;; label = @14
                                local.get 16
                                br_if 0 (;@14;)
                                local.get 4
                                local.set 10
                                local.get 6
                                local.set 31
                                br 2 (;@12;)
                              end
                              local.get 7
                              local.set 10
                              local.get 16
                              local.set 31
                              local.get 6
                              i32.eqz
                              br_if 1 (;@12;)
                              block  ;; label = @14
                                block  ;; label = @15
                                  local.get 7
                                  local.get 4
                                  i32.le_s
                                  br_if 0 (;@15;)
                                  local.get 6
                                  i32.const 1
                                  local.get 7
                                  local.get 4
                                  i32.sub
                                  local.tee 4
                                  i32.shl
                                  i32.add
                                  local.get 4
                                  i32.const 1
                                  i32.add
                                  local.tee 4
                                  i32.shr_s
                                  i32.const 0
                                  local.get 4
                                  i32.const 32
                                  i32.lt_s
                                  select
                                  local.set 6
                                  local.get 7
                                  local.set 4
                                  local.get 24
                                  local.set 10
                                  br 1 (;@14;)
                                end
                                i32.const 1
                                local.get 4
                                local.get 7
                                i32.sub
                                local.tee 10
                                i32.shl
                                local.get 16
                                i32.add
                                local.get 10
                                i32.const 1
                                i32.add
                                local.tee 10
                                i32.shr_s
                                i32.const 0
                                local.get 10
                                i32.const 32
                                i32.lt_s
                                select
                                local.set 10
                                local.get 6
                                i32.const 1
                                i32.shr_s
                                local.set 6
                              end
                              local.get 10
                              local.get 6
                              i32.add
                              local.tee 6
                              local.get 6
                              i32.const 1073741824
                              i32.add
                              local.tee 6
                              i32.const -1
                              i32.xor
                              i32.const 31
                              i32.shr_u
                              i32.shl
                              local.set 31
                              local.get 6
                              i32.const 31
                              i32.shr_u
                              local.get 4
                              i32.add
                              local.set 10
                              br 1 (;@12;)
                            end
                            local.get 7
                            local.set 10
                            local.get 16
                            local.set 31
                            local.get 16
                            br_if 0 (;@12;)
                            local.get 9
                            i32.const 0
                            local.get 8
                            select
                            local.set 4
                            local.get 8
                            local.set 6
                            br 1 (;@11;)
                          end
                          block  ;; label = @12
                            local.get 8
                            br_if 0 (;@12;)
                            local.get 10
                            local.set 4
                            local.get 31
                            local.set 6
                            br 1 (;@11;)
                          end
                          local.get 9
                          local.set 4
                          local.get 8
                          local.set 6
                          local.get 31
                          i32.eqz
                          br_if 0 (;@11;)
                          block  ;; label = @12
                            block  ;; label = @13
                              local.get 9
                              local.get 10
                              i32.le_s
                              br_if 0 (;@13;)
                              i32.const 1
                              local.get 9
                              local.get 10
                              i32.sub
                              local.tee 4
                              i32.shl
                              local.get 31
                              i32.add
                              local.get 4
                              i32.const 1
                              i32.add
                              local.tee 4
                              i32.shr_s
                              i32.const 0
                              local.get 4
                              i32.const 32
                              i32.lt_s
                              select
                              local.set 4
                              local.get 8
                              i32.const 1
                              i32.shr_s
                              local.set 6
                              local.get 9
                              local.set 10
                              br 1 (;@12;)
                            end
                            i32.const 1
                            local.get 10
                            local.get 9
                            i32.sub
                            local.tee 4
                            i32.shl
                            local.get 8
                            i32.add
                            local.get 4
                            i32.const 1
                            i32.add
                            local.tee 4
                            i32.shr_s
                            i32.const 0
                            local.get 4
                            i32.const 32
                            i32.lt_s
                            select
                            local.set 6
                            local.get 31
                            i32.const 1
                            i32.shr_s
                            local.set 4
                          end
                          local.get 6
                          local.get 4
                          i32.add
                          local.tee 4
                          local.get 4
                          i32.const 1073741824
                          i32.add
                          local.tee 4
                          i32.const -1
                          i32.xor
                          i32.const 31
                          i32.shr_u
                          i32.shl
                          local.set 6
                          local.get 4
                          i32.const 31
                          i32.shr_u
                          local.get 10
                          i32.add
                          local.set 4
                        end
                        local.get 29
                        local.get 5
                        i32.const 2
                        i32.shl
                        local.tee 10
                        i32.add
                        local.get 6
                        i32.store
                        local.get 28
                        local.get 10
                        i32.add
                        local.get 4
                        i32.store
                        local.get 1
                        i32.load offset=28
                        local.set 10
                        block  ;; label = @11
                          local.get 11
                          local.get 4
                          i32.ge_s
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.store offset=12
                          local.get 4
                          local.set 11
                        end
                        local.get 4
                        local.get 9
                        local.get 10
                        select
                        local.set 9
                        local.get 6
                        local.get 8
                        local.get 10
                        select
                        local.set 8
                        local.get 13
                        local.get 17
                        i32.mul
                        local.set 13
                        local.get 5
                        i32.const 1
                        i32.add
                        local.tee 5
                        local.get 14
                        i32.ne
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 22
                    i32.const 1
                    i32.add
                    local.set 22
                  end
                  local.get 27
                  i32.const 1
                  i32.add
                  local.tee 27
                  local.get 23
                  i32.ne
                  br_if 0 (;@7;)
                  br 2 (;@5;)
                end
              end
              local.get 16
              i32.const 1
              i32.shr_s
              local.set 23
              local.get 2
              i32.const 15
              i32.shr_s
              local.set 29
              local.get 1
              i32.load offset=8
              local.set 24
              local.get 7
              local.set 11
              i32.const 0
              local.set 30
              i32.const 0
              local.set 25
              loop  ;; label = @6
                block  ;; label = @7
                  local.get 24
                  local.get 30
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  i32.eqz
                  br_if 0 (;@7;)
                  block  ;; label = @8
                    local.get 14
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 1
                    i32.load offset=32
                    local.get 30
                    local.get 14
                    i32.mul
                    i32.const 2
                    i32.shl
                    i32.add
                    local.set 31
                    local.get 21
                    local.get 15
                    local.get 25
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    local.get 14
                    i32.mul
                    i32.const 2
                    i32.shl
                    local.tee 4
                    i32.add
                    local.set 27
                    local.get 18
                    local.get 4
                    i32.add
                    local.set 28
                    i32.const 0
                    local.set 17
                    i32.const 0
                    local.set 8
                    i32.const 0
                    local.set 9
                    loop  ;; label = @9
                      local.get 31
                      local.get 9
                      i32.const 2
                      i32.shl
                      local.tee 13
                      i32.add
                      i32.load
                      local.tee 4
                      local.get 4
                      i32.const 31
                      i32.shr_s
                      local.tee 6
                      i32.xor
                      local.get 6
                      i32.sub
                      local.set 5
                      i32.const 0
                      local.set 6
                      block  ;; label = @10
                        local.get 4
                        i32.eqz
                        br_if 0 (;@10;)
                        i32.const 0
                        local.set 6
                        local.get 5
                        local.set 4
                        loop  ;; label = @11
                          local.get 6
                          i32.const 1
                          i32.add
                          local.set 6
                          local.get 4
                          i32.const 1
                          i32.gt_u
                          local.set 10
                          local.get 4
                          i32.const 1
                          i32.shr_u
                          local.set 4
                          local.get 10
                          br_if 0 (;@11;)
                        end
                      end
                      block  ;; label = @10
                        block  ;; label = @11
                          block  ;; label = @12
                            local.get 2
                            i32.eqz
                            br_if 0 (;@12;)
                            local.get 5
                            i32.const 31
                            local.get 6
                            i32.sub
                            i32.shl
                            local.tee 10
                            i32.eqz
                            br_if 0 (;@12;)
                            local.get 6
                            local.get 19
                            i32.add
                            local.set 4
                            local.get 10
                            i32.const 16
                            i32.shr_s
                            local.get 29
                            i32.mul
                            local.set 6
                            block  ;; label = @13
                              local.get 16
                              br_if 0 (;@13;)
                              local.get 4
                              local.set 10
                              local.get 6
                              local.set 5
                              br 2 (;@11;)
                            end
                            local.get 7
                            local.set 10
                            local.get 16
                            local.set 5
                            local.get 6
                            i32.eqz
                            br_if 1 (;@11;)
                            block  ;; label = @13
                              block  ;; label = @14
                                local.get 7
                                local.get 4
                                i32.le_s
                                br_if 0 (;@14;)
                                local.get 6
                                i32.const 1
                                local.get 7
                                local.get 4
                                i32.sub
                                local.tee 4
                                i32.shl
                                i32.add
                                local.get 4
                                i32.const 1
                                i32.add
                                local.tee 4
                                i32.shr_s
                                i32.const 0
                                local.get 4
                                i32.const 32
                                i32.lt_s
                                select
                                local.set 6
                                local.get 7
                                local.set 4
                                local.get 23
                                local.set 10
                                br 1 (;@13;)
                              end
                              i32.const 1
                              local.get 4
                              local.get 7
                              i32.sub
                              local.tee 10
                              i32.shl
                              local.get 16
                              i32.add
                              local.get 10
                              i32.const 1
                              i32.add
                              local.tee 10
                              i32.shr_s
                              i32.const 0
                              local.get 10
                              i32.const 32
                              i32.lt_s
                              select
                              local.set 10
                              local.get 6
                              i32.const 1
                              i32.shr_s
                              local.set 6
                            end
                            local.get 10
                            local.get 6
                            i32.add
                            local.tee 6
                            local.get 6
                            i32.const 1073741824
                            i32.add
                            local.tee 6
                            i32.const -1
                            i32.xor
                            i32.const 31
                            i32.shr_u
                            i32.shl
                            local.set 5
                            local.get 6
                            i32.const 31
                            i32.shr_u
                            local.get 4
                            i32.add
                            local.set 10
                            br 1 (;@11;)
                          end
                          local.get 7
                          local.set 10
                          local.get 16
                          local.set 5
                          local.get 16
                          br_if 0 (;@11;)
                          local.get 17
                          i32.const 0
                          local.get 8
                          select
                          local.set 4
                          local.get 8
                          local.set 6
                          br 1 (;@10;)
                        end
                        block  ;; label = @11
                          local.get 8
                          br_if 0 (;@11;)
                          local.get 10
                          local.set 4
                          local.get 5
                          local.set 6
                          br 1 (;@10;)
                        end
                        local.get 17
                        local.set 4
                        local.get 8
                        local.set 6
                        local.get 5
                        i32.eqz
                        br_if 0 (;@10;)
                        block  ;; label = @11
                          block  ;; label = @12
                            local.get 17
                            local.get 10
                            i32.le_s
                            br_if 0 (;@12;)
                            i32.const 1
                            local.get 17
                            local.get 10
                            i32.sub
                            local.tee 4
                            i32.shl
                            local.get 5
                            i32.add
                            local.get 4
                            i32.const 1
                            i32.add
                            local.tee 4
                            i32.shr_s
                            i32.const 0
                            local.get 4
                            i32.const 32
                            i32.lt_s
                            select
                            local.set 4
                            local.get 8
                            i32.const 1
                            i32.shr_s
                            local.set 6
                            local.get 17
                            local.set 10
                            br 1 (;@11;)
                          end
                          i32.const 1
                          local.get 10
                          local.get 17
                          i32.sub
                          local.tee 4
                          i32.shl
                          local.get 8
                          i32.add
                          local.get 4
                          i32.const 1
                          i32.add
                          local.tee 4
                          i32.shr_s
                          i32.const 0
                          local.get 4
                          i32.const 32
                          i32.lt_s
                          select
                          local.set 6
                          local.get 5
                          i32.const 1
                          i32.shr_s
                          local.set 4
                        end
                        local.get 6
                        local.get 4
                        i32.add
                        local.tee 4
                        local.get 4
                        i32.const 1073741824
                        i32.add
                        local.tee 4
                        i32.const -1
                        i32.xor
                        i32.const 31
                        i32.shr_u
                        i32.shl
                        local.set 6
                        local.get 4
                        i32.const 31
                        i32.shr_u
                        local.get 10
                        i32.add
                        local.set 4
                      end
                      local.get 28
                      local.get 13
                      i32.add
                      local.get 6
                      i32.store
                      local.get 27
                      local.get 13
                      i32.add
                      local.get 4
                      i32.store
                      local.get 1
                      i32.load offset=28
                      local.set 10
                      block  ;; label = @10
                        local.get 11
                        local.get 4
                        i32.ge_s
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i32.store offset=12
                        local.get 4
                        local.set 11
                      end
                      local.get 4
                      local.get 17
                      local.get 10
                      select
                      local.set 17
                      local.get 6
                      local.get 8
                      local.get 10
                      select
                      local.set 8
                      local.get 9
                      i32.const 1
                      i32.add
                      local.tee 9
                      local.get 14
                      i32.ne
                      br_if 0 (;@9;)
                    end
                  end
                  local.get 25
                  i32.const 1
                  i32.add
                  local.set 25
                end
                local.get 30
                i32.const 1
                i32.add
                local.tee 30
                local.get 22
                i32.ne
                br_if 0 (;@6;)
              end
            end
            block  ;; label = @5
              local.get 20
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              i32.const 0
              local.set 10
              block  ;; label = @6
                local.get 20
                i32.const 1
                i32.eq
                br_if 0 (;@6;)
                local.get 20
                i32.const 1
                i32.and
                local.set 9
                local.get 20
                i32.const 2147483646
                i32.and
                local.set 17
                i32.const 0
                local.set 10
                local.get 21
                local.set 4
                local.get 18
                local.set 6
                loop  ;; label = @7
                  block  ;; label = @8
                    local.get 11
                    local.get 4
                    i32.load
                    local.tee 8
                    i32.le_s
                    br_if 0 (;@8;)
                    local.get 6
                    local.get 6
                    i32.load
                    local.get 11
                    local.get 8
                    i32.sub
                    i32.shr_s
                    i32.store
                  end
                  block  ;; label = @8
                    local.get 11
                    local.get 4
                    i32.const 4
                    i32.add
                    i32.load
                    local.tee 8
                    i32.le_s
                    br_if 0 (;@8;)
                    local.get 6
                    i32.const 4
                    i32.add
                    local.tee 16
                    local.get 16
                    i32.load
                    local.get 11
                    local.get 8
                    i32.sub
                    i32.shr_s
                    i32.store
                  end
                  local.get 4
                  i32.const 8
                  i32.add
                  local.set 4
                  local.get 6
                  i32.const 8
                  i32.add
                  local.set 6
                  local.get 17
                  local.get 10
                  i32.const 2
                  i32.add
                  local.tee 10
                  i32.ne
                  br_if 0 (;@7;)
                end
                local.get 9
                i32.eqz
                br_if 1 (;@5;)
              end
              local.get 11
              local.get 21
              local.get 10
              i32.const 2
              i32.shl
              local.tee 4
              i32.add
              i32.load
              local.tee 6
              i32.le_s
              br_if 0 (;@5;)
              local.get 18
              local.get 4
              i32.add
              local.tee 4
              local.get 4
              i32.load
              local.get 11
              local.get 6
              i32.sub
              i32.shr_s
              i32.store
            end
            local.get 21
            call $free
          end
          local.get 0
          local.get 18
          i32.store offset=16
          local.get 0
          local.get 12
          call $malloc
          local.tee 17
          i32.store offset=24
          block  ;; label = @4
            block  ;; label = @5
              local.get 1
              i32.load offset=4
              local.tee 10
              i32.const 0
              i32.gt_s
              br_if 0 (;@5;)
              i32.const 0
              local.set 9
              local.get 0
              i32.const 0
              call $malloc
              i32.store offset=28
              local.get 0
              i32.const 28
              i32.add
              local.set 17
              br 1 (;@4;)
            end
            local.get 1
            i32.load offset=8
            local.set 9
            i32.const 0
            local.set 6
            i32.const 0
            local.set 8
            block  ;; label = @5
              block  ;; label = @6
                local.get 10
                i32.const 1
                i32.eq
                br_if 0 (;@6;)
                local.get 10
                i32.const 1
                i32.and
                local.set 13
                local.get 10
                i32.const 2147483646
                i32.and
                local.set 16
                i32.const 0
                local.set 8
                local.get 9
                local.set 4
                i32.const 0
                local.set 6
                loop  ;; label = @7
                  block  ;; label = @8
                    local.get 4
                    i32.load
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 17
                    local.get 15
                    local.get 6
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    i32.const 2
                    i32.shl
                    i32.add
                    local.get 8
                    i32.store
                    local.get 6
                    i32.const 1
                    i32.add
                    local.set 6
                  end
                  block  ;; label = @8
                    local.get 4
                    i32.const 4
                    i32.add
                    i32.load
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 17
                    local.get 15
                    local.get 6
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    i32.const 2
                    i32.shl
                    i32.add
                    local.get 8
                    i32.const 1
                    i32.add
                    i32.store
                    local.get 6
                    i32.const 1
                    i32.add
                    local.set 6
                  end
                  local.get 4
                  i32.const 8
                  i32.add
                  local.set 4
                  local.get 16
                  local.get 8
                  i32.const 2
                  i32.add
                  local.tee 8
                  i32.ne
                  br_if 0 (;@7;)
                end
                local.get 13
                i32.eqz
                br_if 1 (;@5;)
              end
              local.get 9
              local.get 8
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 17
              local.get 15
              local.get 6
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.get 8
              i32.store
              local.get 6
              i32.const 1
              i32.add
              local.set 6
            end
            local.get 0
            local.get 6
            call $malloc
            i32.store offset=28
            local.get 0
            i32.const 28
            i32.add
            local.set 17
            i32.const 0
            local.set 4
            i32.const 0
            local.set 6
            i32.const 0
            local.set 9
            loop  ;; label = @5
              block  ;; label = @6
                local.get 1
                i32.load offset=8
                local.get 4
                i32.add
                i32.load
                local.tee 8
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                local.get 17
                i32.load
                local.get 15
                local.get 9
                i32.const 2
                i32.shl
                i32.add
                i32.load
                i32.add
                local.get 8
                i32.store8
                local.get 9
                i32.const 1
                i32.add
                local.set 9
                local.get 1
                i32.load offset=4
                local.set 10
              end
              local.get 4
              i32.const 4
              i32.add
              local.set 4
              local.get 6
              i32.const 1
              i32.add
              local.tee 6
              local.get 10
              i32.lt_s
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            block  ;; label = @5
              local.get 0
              i32.load offset=8
              local.tee 4
              br_if 0 (;@5;)
              i32.const -4
              local.set 4
              br 1 (;@4;)
            end
            i32.const -1
            local.set 6
            loop  ;; label = @5
              local.get 6
              i32.const 1
              i32.add
              local.set 6
              local.get 4
              i32.const 1
              i32.gt_u
              local.set 10
              local.get 4
              i32.const 1
              i32.shr_u
              local.set 4
              local.get 10
              br_if 0 (;@5;)
            end
            local.get 6
            i32.const -3
            i32.add
            local.set 4
          end
          local.get 0
          local.get 4
          i32.const 5
          local.get 4
          i32.const 5
          i32.gt_s
          select
          local.tee 4
          i32.const 8
          local.get 4
          i32.const 8
          i32.lt_u
          select
          local.tee 10
          i32.store offset=36
          i32.const 0
          local.set 15
          i32.const 1
          local.get 10
          i32.shl
          local.tee 1
          i32.const 4
          call $calloc
          local.set 13
          local.get 0
          i32.const 0
          i32.store offset=40
          local.get 0
          local.get 13
          i32.store offset=32
          block  ;; label = @4
            local.get 9
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 17
            i32.load
            local.set 7
            i32.const 0
            local.set 5
            i32.const 0
            local.set 11
            loop  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  local.get 5
                  local.get 7
                  local.get 11
                  i32.add
                  local.tee 8
                  i32.load8_s
                  local.tee 4
                  i32.lt_s
                  br_if 0 (;@7;)
                  local.get 4
                  local.set 6
                  br 1 (;@6;)
                end
                local.get 0
                local.get 4
                i32.store offset=40
                local.get 8
                i32.load8_s
                local.set 6
                local.get 4
                local.set 5
              end
              block  ;; label = @6
                local.get 10
                local.get 6
                i32.lt_s
                br_if 0 (;@6;)
                local.get 10
                local.get 6
                i32.sub
                i32.const 31
                i32.eq
                br_if 0 (;@6;)
                local.get 0
                i32.load offset=20
                local.get 11
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.tee 4
                i32.const 24
                i32.shl
                local.get 4
                i32.const 65280
                i32.and
                i32.const 8
                i32.shl
                i32.or
                local.get 4
                i32.const 8
                i32.shr_u
                i32.const 65280
                i32.and
                local.get 4
                i32.const 24
                i32.shr_u
                i32.or
                i32.or
                local.tee 4
                i32.const 4
                i32.shr_u
                i32.const 252645135
                i32.and
                local.get 4
                i32.const 252645135
                i32.and
                i32.const 4
                i32.shl
                i32.or
                local.tee 4
                i32.const 2
                i32.shr_u
                i32.const 858993459
                i32.and
                local.get 4
                i32.const 858993459
                i32.and
                i32.const 2
                i32.shl
                i32.or
                local.tee 4
                i32.const 1
                i32.shr_u
                i32.const 1431655765
                i32.and
                local.get 4
                i32.const 1431655765
                i32.and
                i32.const 1
                i32.shl
                i32.or
                local.set 17
                local.get 11
                i32.const 1
                i32.add
                local.set 16
                i32.const 0
                local.set 4
                loop  ;; label = @7
                  local.get 13
                  local.get 4
                  local.get 6
                  i32.shl
                  local.get 17
                  i32.or
                  i32.const 2
                  i32.shl
                  i32.add
                  local.get 16
                  i32.store
                  local.get 4
                  i32.const 1
                  i32.add
                  local.tee 4
                  i32.const 1
                  local.get 10
                  local.get 8
                  i32.load8_s
                  local.tee 6
                  i32.sub
                  i32.shl
                  i32.lt_s
                  br_if 0 (;@7;)
                end
              end
              local.get 11
              i32.const 1
              i32.add
              local.tee 11
              local.get 9
              i32.ne
              br_if 0 (;@5;)
            end
          end
          i32.const 32
          local.get 10
          i32.sub
          local.set 7
          i32.const -2
          local.get 10
          i32.const 31
          i32.xor
          i32.shl
          local.set 11
          i32.const 0
          local.set 17
          i32.const 0
          local.set 4
          loop  ;; label = @4
            block  ;; label = @5
              local.get 13
              local.get 15
              local.get 7
              i32.shl
              local.tee 10
              i32.const 24
              i32.shl
              local.get 10
              i32.const 65280
              i32.and
              i32.const 8
              i32.shl
              i32.or
              local.get 10
              i32.const 8
              i32.shr_u
              i32.const 65280
              i32.and
              local.get 10
              i32.const 24
              i32.shr_u
              i32.or
              i32.or
              local.tee 6
              i32.const 4
              i32.shr_u
              i32.const 252645135
              i32.and
              local.get 6
              i32.const 252645135
              i32.and
              i32.const 4
              i32.shl
              i32.or
              local.tee 6
              i32.const 2
              i32.shr_u
              i32.const 858993459
              i32.and
              local.get 6
              i32.const 858993459
              i32.and
              i32.const 2
              i32.shl
              i32.or
              local.tee 6
              i32.const 357913941
              i32.and
              i32.const 3
              i32.shl
              local.get 6
              i32.const 1
              i32.shl
              i32.const 1431655764
              i32.and
              i32.or
              i32.add
              local.tee 5
              i32.load
              br_if 0 (;@5;)
              local.get 9
              local.get 4
              i32.const 1
              i32.add
              local.tee 6
              local.get 9
              local.get 6
              i32.gt_s
              select
              i32.const -1
              i32.add
              local.set 16
              local.get 4
              i32.const 2
              i32.shl
              i32.const 4
              i32.add
              local.set 6
              block  ;; label = @6
                loop  ;; label = @7
                  block  ;; label = @8
                    local.get 16
                    local.get 4
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 16
                    local.set 4
                    br 2 (;@6;)
                  end
                  local.get 4
                  i32.const 1
                  i32.add
                  local.set 4
                  local.get 0
                  i32.load offset=20
                  local.get 6
                  i32.add
                  local.set 8
                  local.get 6
                  i32.const 4
                  i32.add
                  local.set 6
                  local.get 8
                  i32.load
                  local.get 10
                  i32.le_u
                  br_if 0 (;@7;)
                end
                local.get 4
                i32.const -1
                i32.add
                local.set 4
              end
              block  ;; label = @6
                local.get 17
                local.get 9
                i32.ge_s
                br_if 0 (;@6;)
                local.get 0
                i32.load offset=20
                local.get 17
                i32.const 2
                i32.shl
                i32.add
                local.set 6
                loop  ;; label = @7
                  local.get 10
                  local.get 6
                  i32.load
                  local.get 11
                  i32.and
                  i32.lt_u
                  br_if 1 (;@6;)
                  local.get 6
                  i32.const 4
                  i32.add
                  local.set 6
                  local.get 9
                  local.get 17
                  i32.const 1
                  i32.add
                  local.tee 17
                  i32.ne
                  br_if 0 (;@7;)
                end
                local.get 9
                local.set 17
              end
              local.get 5
              local.get 9
              local.get 17
              i32.sub
              local.tee 6
              i32.const 32767
              local.get 6
              i32.const 32767
              i32.lt_u
              select
              local.get 4
              i32.const 32767
              local.get 4
              i32.const 32767
              i32.lt_u
              select
              i32.const 15
              i32.shl
              i32.or
              i32.const -2147483648
              i32.or
              i32.store
            end
            local.get 15
            i32.const 1
            i32.add
            local.tee 15
            local.get 1
            i32.ne
            br_if 0 (;@4;)
          end
        end
        i32.const 0
        local.set 4
        br 1 (;@1;)
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=16
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=20
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=24
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=28
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=32
        local.tee 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        call $free
      end
      local.get 0
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 48
      i32.add
      i32.const 0
      i32.store
      local.get 0
      i32.const 40
      i32.add
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 32
      i32.add
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 24
      i32.add
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 16
      i32.add
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 8
      i32.add
      i64.const 0
      i64.store align=4
      i32.const -1
      local.set 4
    end
    local.get 3
    i32.const 144
    i32.add
    global.set $__stack_pointer
    local.get 4)
  (func $mapping0_look (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.load offset=4
    local.tee 3
    i32.load offset=28
    local.set 4
    i32.const 1
    i32.const 32
    call $calloc
    local.tee 5
    local.get 1
    i32.store
    local.get 5
    local.get 2
    i32.store offset=4
    local.get 5
    local.get 2
    i32.load
    local.tee 6
    i32.const 4
    call $calloc
    local.tee 7
    i32.store offset=8
    local.get 5
    local.get 6
    i32.const 4
    call $calloc
    local.tee 8
    i32.store offset=12
    local.get 5
    local.get 6
    i32.const 4
    call $calloc
    local.tee 9
    i32.store offset=16
    local.get 5
    local.get 6
    i32.const 4
    call $calloc
    local.tee 10
    i32.store offset=20
    block  ;; label = @1
      local.get 6
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      i32.const 0
      local.set 6
      i32.const 0
      local.set 11
      loop  ;; label = @2
        local.get 9
        local.get 6
        i32.add
        local.get 4
        local.get 2
        local.get 6
        i32.add
        local.tee 12
        i32.const 1028
        i32.add
        i32.load
        i32.const 2
        i32.shl
        i32.add
        local.tee 13
        i32.const 1056
        i32.add
        i32.load
        i32.const 2
        i32.shl
        i32.const 16789992
        i32.add
        i32.load
        local.tee 14
        i32.store
        local.get 12
        i32.const 1092
        i32.add
        i32.load
        local.set 12
        local.get 7
        local.get 6
        i32.add
        local.get 0
        local.get 1
        local.get 13
        i32.const 1312
        i32.add
        i32.load
        local.get 14
        i32.load offset=4
        call_indirect (type 3)
        i32.store
        local.get 10
        local.get 6
        i32.add
        local.get 4
        local.get 12
        i32.const 2
        i32.shl
        i32.add
        local.tee 12
        i32.const 1568
        i32.add
        i32.load
        i32.const 2
        i32.shl
        i32.const 16790000
        i32.add
        i32.load
        local.tee 13
        i32.store
        local.get 8
        local.get 6
        i32.add
        local.get 0
        local.get 1
        local.get 12
        i32.const 1824
        i32.add
        i32.load
        local.get 13
        i32.load offset=4
        call_indirect (type 3)
        i32.store
        local.get 6
        i32.const 4
        i32.add
        local.set 6
        local.get 11
        i32.const 1
        i32.add
        local.tee 11
        local.get 2
        i32.load
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    local.get 5
    local.get 3
    i32.load offset=4
    i32.store offset=24
    local.get 5)
  (func $mapping0_free_look (type 4) (param i32)
    (local i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 0
        i32.load offset=4
        i32.load
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 1
        i32.const 0
        local.set 2
        loop  ;; label = @3
          local.get 0
          i32.load offset=8
          local.get 1
          i32.add
          i32.load
          local.get 0
          i32.load offset=16
          local.get 1
          i32.add
          i32.load
          i32.load offset=12
          call_indirect (type 4)
          local.get 0
          i32.load offset=12
          local.get 1
          i32.add
          i32.load
          local.get 0
          i32.load offset=20
          local.get 1
          i32.add
          i32.load
          i32.load offset=12
          call_indirect (type 4)
          local.get 1
          i32.const 4
          i32.add
          local.set 1
          local.get 2
          i32.const 1
          i32.add
          local.tee 2
          local.get 0
          i32.load offset=4
          i32.load
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 0
      i32.load offset=16
      call $free
      local.get 0
      i32.load offset=20
      call $free
      local.get 0
      i32.load offset=8
      call $free
      local.get 0
      i32.load offset=12
      call $free
      local.get 0
      call $free
    end)
  (func $vorbis_comment_clear (type 4) (param i32)
    (local i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 0
        i32.load
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 0
          i32.load offset=8
          local.tee 2
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 1
          i32.const 0
          local.set 3
          loop  ;; label = @4
            block  ;; label = @5
              local.get 0
              i32.load
              local.get 1
              i32.add
              i32.load
              local.tee 4
              i32.eqz
              br_if 0 (;@5;)
              local.get 4
              call $free
              local.get 0
              i32.load offset=8
              local.set 2
            end
            local.get 1
            i32.const 4
            i32.add
            local.set 1
            local.get 3
            i32.const 1
            i32.add
            local.tee 3
            local.get 2
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 0
          i32.load
          local.set 1
        end
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=4
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=12
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      local.get 0
      i64.const 0
      i64.store align=4
      local.get 0
      i32.const 8
      i32.add
      i64.const 0
      i64.store align=4
    end)
  (func $vorbis_info_clear (type 4) (param i32)
    (local i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.load offset=28
      local.tee 1
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 1
        i32.load offset=8
        local.tee 2
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 32
        i32.add
        local.set 3
        i32.const 0
        local.set 4
        loop  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.load
            local.tee 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 5
            call $free
            local.get 1
            i32.load offset=8
            local.set 2
          end
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 4
          i32.const 1
          i32.add
          local.tee 4
          local.get 2
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=12
        local.tee 2
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 544
        i32.add
        local.set 3
        i32.const 0
        local.set 4
        loop  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.load
            local.tee 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 5
            call $mapping0_free_info
            local.get 1
            i32.load offset=12
            local.set 2
          end
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 4
          i32.const 1
          i32.add
          local.tee 4
          local.get 2
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=20
        local.tee 2
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 1056
        i32.add
        local.set 3
        i32.const 0
        local.set 4
        loop  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.const 256
            i32.add
            i32.load
            local.tee 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 5
            local.get 3
            i32.load
            i32.const 2
            i32.shl
            i32.const 16789992
            i32.add
            i32.load
            i32.load offset=8
            call_indirect (type 4)
            local.get 1
            i32.load offset=20
            local.set 2
          end
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 4
          i32.const 1
          i32.add
          local.tee 4
          local.get 2
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=24
        local.tee 2
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 1568
        i32.add
        local.set 3
        i32.const 0
        local.set 4
        loop  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.const 256
            i32.add
            i32.load
            local.tee 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 5
            local.get 3
            i32.load
            i32.const 2
            i32.shl
            i32.const 16790000
            i32.add
            i32.load
            i32.load offset=8
            call_indirect (type 4)
            local.get 1
            i32.load offset=24
            local.set 2
          end
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 4
          i32.const 1
          i32.add
          local.tee 4
          local.get 2
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=28
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 2080
        i32.add
        local.set 2
        i32.const 32
        local.set 5
        i32.const 0
        local.set 6
        loop  ;; label = @3
          block  ;; label = @4
            local.get 2
            i32.load
            local.tee 3
            i32.eqz
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 3
              i32.load offset=32
              local.tee 4
              i32.eqz
              br_if 0 (;@5;)
              local.get 4
              call $free
            end
            block  ;; label = @5
              local.get 3
              i32.load offset=8
              local.tee 4
              i32.eqz
              br_if 0 (;@5;)
              local.get 4
              call $free
            end
            local.get 3
            call $free
          end
          block  ;; label = @4
            local.get 1
            i32.load offset=3104
            local.tee 3
            i32.eqz
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 3
              local.get 5
              i32.add
              local.tee 4
              i32.const -16
              i32.add
              i32.load
              local.tee 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 3
              call $free
            end
            block  ;; label = @5
              local.get 4
              i32.const -12
              i32.add
              i32.load
              local.tee 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 3
              call $free
            end
            block  ;; label = @5
              local.get 4
              i32.const -8
              i32.add
              i32.load
              local.tee 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 3
              call $free
            end
            block  ;; label = @5
              local.get 4
              i32.const -4
              i32.add
              i32.load
              local.tee 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 3
              call $free
            end
            local.get 4
            i32.const -32
            i32.add
            local.set 3
            block  ;; label = @5
              local.get 4
              i32.load
              local.tee 4
              i32.eqz
              br_if 0 (;@5;)
              local.get 4
              call $free
            end
            local.get 3
            i64.const 0
            i64.store align=4
            local.get 3
            i32.const 48
            i32.add
            i32.const 0
            i32.store
            local.get 3
            i32.const 40
            i32.add
            i64.const 0
            i64.store align=4
            local.get 3
            i32.const 32
            i32.add
            i64.const 0
            i64.store align=4
            local.get 3
            i32.const 24
            i32.add
            i64.const 0
            i64.store align=4
            local.get 3
            i32.const 16
            i32.add
            i64.const 0
            i64.store align=4
            local.get 3
            i32.const 8
            i32.add
            i64.const 0
            i64.store align=4
          end
          local.get 2
          i32.const 4
          i32.add
          local.set 2
          local.get 5
          i32.const 52
          i32.add
          local.set 5
          local.get 6
          i32.const 1
          i32.add
          local.tee 6
          local.get 1
          i32.load offset=28
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=3104
        local.tee 3
        i32.eqz
        br_if 0 (;@2;)
        local.get 3
        call $free
      end
      local.get 1
      call $free
    end
    local.get 0
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 24
    i32.add
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 16
    i32.add
    i64.const 0
    i64.store align=4
    local.get 0
    i32.const 8
    i32.add
    i64.const 0
    i64.store align=4)
  (func $mapping0_free_info (type 4) (param i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      call $free
    end)
  (func $vorbis_synthesis_headerin (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 32
    i32.sub
    local.tee 3
    global.set $__stack_pointer
    block  ;; label = @1
      block  ;; label = @2
        local.get 2
        br_if 0 (;@2;)
        i32.const -133
        local.set 4
        br 1 (;@1;)
      end
      local.get 3
      i64.const 0
      i64.store offset=8
      local.get 3
      local.get 2
      i32.load
      local.tee 4
      i32.store offset=20
      local.get 3
      local.get 2
      i32.load offset=4
      local.tee 5
      i32.store offset=24
      local.get 3
      local.get 4
      i32.store offset=16
      local.get 5
      i32.const -4
      i32.add
      local.set 6
      i32.const -1
      local.set 7
      block  ;; label = @2
        block  ;; label = @3
          local.get 5
          i32.const -1
          i32.add
          local.tee 8
          i32.const -2147483646
          i32.le_u
          br_if 0 (;@3;)
          i32.const 1
          local.set 4
          i32.const 0
          local.set 9
          local.get 5
          local.set 10
          br 1 (;@2;)
        end
        i32.const 1
        local.set 10
        local.get 4
        i32.const 1
        i32.add
        local.set 9
        local.get 4
        i32.load8_u
        local.set 7
        i32.const 0
        local.set 4
      end
      local.get 3
      local.get 4
      i32.store offset=12
      local.get 3
      local.get 9
      i32.store offset=20
      local.get 3
      local.get 10
      i32.store offset=8
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 10
            local.get 6
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.get 5
            local.get 4
            i32.const 15
            i32.add
            i32.const 3
            i32.shr_u
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
          end
          local.get 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 11
          block  ;; label = @4
            local.get 8
            i32.const -2147483645
            i32.lt_u
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 11
            i32.or
            local.set 11
          end
          local.get 3
          local.get 9
          i32.const 1
          i32.add
          local.tee 9
          i32.store offset=20
          local.get 10
          i32.const 1
          i32.add
          local.set 10
          local.get 11
          i32.const 255
          i32.and
          local.set 8
          br 1 (;@2;)
        end
        i32.const 0
        local.set 9
        local.get 3
        i32.const 0
        i32.store offset=20
        i32.const 255
        local.set 8
        i32.const 1
        local.set 4
        local.get 5
        local.set 10
      end
      local.get 3
      local.get 4
      i32.store offset=12
      local.get 3
      local.get 10
      i32.store offset=8
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 10
            local.get 6
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.get 5
            local.get 4
            i32.const 15
            i32.add
            i32.const 3
            i32.shr_u
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
          end
          local.get 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 11
          block  ;; label = @4
            local.get 4
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 11
            i32.or
            local.set 11
          end
          local.get 3
          local.get 10
          i32.const 1
          i32.add
          local.tee 10
          i32.store offset=8
          local.get 3
          local.get 9
          i32.const 1
          i32.add
          local.tee 9
          i32.store offset=20
          local.get 11
          i32.const 255
          i32.and
          local.set 12
          br 1 (;@2;)
        end
        local.get 3
        local.get 5
        i32.store offset=8
        i32.const 0
        local.set 9
        local.get 3
        i32.const 0
        i32.store offset=20
        i32.const 255
        local.set 12
        i32.const 1
        local.set 4
        local.get 5
        local.set 10
      end
      local.get 3
      local.get 4
      i32.store offset=12
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 10
            local.get 6
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.get 5
            local.get 4
            i32.const 15
            i32.add
            i32.const 3
            i32.shr_u
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
          end
          local.get 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 11
          block  ;; label = @4
            local.get 4
            i32.eqz
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 11
            i32.or
            local.set 11
          end
          local.get 3
          local.get 9
          i32.const 1
          i32.add
          local.tee 9
          i32.store offset=20
          local.get 10
          i32.const 1
          i32.add
          local.set 10
          local.get 11
          i32.const 255
          i32.and
          local.set 13
          br 1 (;@2;)
        end
        i32.const 0
        local.set 9
        local.get 3
        i32.const 0
        i32.store offset=20
        i32.const 255
        local.set 13
        i32.const 1
        local.set 4
        local.get 5
        local.set 10
      end
      local.get 3
      local.get 4
      i32.store offset=12
      local.get 3
      local.get 10
      i32.store offset=8
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 10
            local.get 6
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.get 5
            local.get 4
            i32.const 15
            i32.add
            i32.const 3
            i32.shr_u
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
          end
          local.get 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 11
          block  ;; label = @4
            local.get 4
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 11
            i32.or
            local.set 11
          end
          local.get 3
          local.get 10
          i32.const 1
          i32.add
          local.tee 10
          i32.store offset=8
          local.get 3
          local.get 9
          i32.const 1
          i32.add
          local.tee 9
          i32.store offset=20
          local.get 11
          i32.const 255
          i32.and
          i32.const 98
          i32.eq
          local.set 14
          br 1 (;@2;)
        end
        local.get 3
        local.get 5
        i32.store offset=8
        i32.const 0
        local.set 9
        local.get 3
        i32.const 0
        i32.store offset=20
        i32.const 1
        local.set 4
        local.get 5
        local.set 10
        i32.const 0
        local.set 14
      end
      local.get 3
      local.get 4
      i32.store offset=12
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 10
            local.get 6
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.get 5
            local.get 4
            i32.const 15
            i32.add
            i32.const 3
            i32.shr_u
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
          end
          local.get 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 11
          block  ;; label = @4
            local.get 4
            i32.eqz
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 11
            i32.or
            local.set 11
          end
          local.get 3
          local.get 4
          i32.store offset=12
          local.get 3
          local.get 10
          i32.const 1
          i32.add
          local.tee 10
          i32.store offset=8
          local.get 3
          local.get 9
          i32.const 1
          i32.add
          local.tee 9
          i32.store offset=20
          local.get 11
          i32.const 255
          i32.and
          i32.const 105
          i32.eq
          local.set 11
          br 1 (;@2;)
        end
        i32.const 1
        local.set 4
        local.get 3
        i32.const 1
        i32.store offset=12
        local.get 3
        local.get 5
        i32.store offset=8
        i32.const 0
        local.set 9
        local.get 3
        i32.const 0
        i32.store offset=20
        local.get 5
        local.set 10
        i32.const 0
        local.set 11
      end
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 10
            local.get 6
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.get 5
            local.get 4
            i32.const 15
            i32.add
            i32.const 3
            i32.shr_u
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
          end
          local.get 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 5
          block  ;; label = @4
            local.get 4
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 5
            i32.or
            local.set 5
          end
          local.get 3
          local.get 4
          i32.store offset=12
          local.get 3
          local.get 10
          i32.const 1
          i32.add
          i32.store offset=8
          local.get 3
          local.get 9
          i32.const 1
          i32.add
          i32.store offset=20
          local.get 5
          i32.const 255
          i32.and
          i32.const 115
          i32.ne
          local.set 6
          br 1 (;@2;)
        end
        i32.const 1
        local.set 6
        local.get 3
        i32.const 1
        i32.store offset=12
        local.get 3
        local.get 5
        i32.store offset=8
        local.get 3
        i32.const 0
        i32.store offset=20
      end
      i32.const -132
      local.set 4
      local.get 8
      i32.const 118
      i32.eq
      local.get 12
      i32.const 111
      i32.eq
      i32.and
      local.get 13
      i32.const 114
      i32.eq
      i32.and
      local.get 14
      i32.and
      local.get 11
      i32.and
      i32.const 1
      i32.ne
      br_if 0 (;@1;)
      local.get 6
      br_if 0 (;@1;)
      i32.const -133
      local.set 4
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 7
            i32.const -1
            i32.add
            br_table 0 (;@4;) 3 (;@1;) 1 (;@3;) 3 (;@1;) 2 (;@2;) 3 (;@1;)
          end
          block  ;; label = @4
            local.get 2
            i32.load offset=8
            br_if 0 (;@4;)
            i32.const -133
            local.set 4
            br 3 (;@1;)
          end
          i32.const -133
          local.set 4
          local.get 0
          i32.load offset=8
          br_if 2 (;@1;)
          local.get 0
          local.get 3
          i32.const 8
          i32.add
          call $_vorbis_unpack_info
          local.set 4
          br 2 (;@1;)
        end
        block  ;; label = @3
          local.get 0
          i32.load offset=8
          br_if 0 (;@3;)
          i32.const -133
          local.set 4
          br 2 (;@1;)
        end
        i32.const -133
        local.set 4
        local.get 1
        i32.load offset=12
        br_if 1 (;@1;)
        local.get 1
        local.get 3
        i32.const 8
        i32.add
        call $_vorbis_unpack_comment
        local.set 4
        br 1 (;@1;)
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=8
        br_if 0 (;@2;)
        i32.const -133
        local.set 4
        br 1 (;@1;)
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=12
        br_if 0 (;@2;)
        i32.const -133
        local.set 4
        br 1 (;@1;)
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=28
        local.tee 5
        br_if 0 (;@2;)
        i32.const -129
        local.set 4
        br 1 (;@1;)
      end
      i32.const -133
      local.set 4
      local.get 5
      i32.load offset=28
      i32.const 0
      i32.gt_s
      br_if 0 (;@1;)
      local.get 0
      local.get 3
      i32.const 8
      i32.add
      call $_vorbis_unpack_books
      local.set 4
    end
    local.get 3
    i32.const 32
    i32.add
    global.set $__stack_pointer
    local.get 4)
  (func $_vorbis_unpack_info (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.load offset=28
      local.tee 2
      br_if 0 (;@1;)
      i32.const -129
      return
    end
    local.get 0
    local.get 1
    i32.const 32
    call $oggpack_read
    local.tee 3
    i32.store
    i32.const -134
    local.set 4
    block  ;; label = @1
      local.get 3
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      i32.const 8
      call $oggpack_read
      i32.store offset=4
      local.get 0
      local.get 1
      i32.const 32
      call $oggpack_read
      i32.store offset=8
      local.get 0
      local.get 1
      i32.const 32
      call $oggpack_read
      i32.store offset=12
      local.get 0
      local.get 1
      i32.const 32
      call $oggpack_read
      i32.store offset=16
      local.get 0
      local.get 1
      i32.const 32
      call $oggpack_read
      i32.store offset=20
      local.get 2
      i32.const 1
      local.get 1
      i32.const 4
      call $oggpack_read
      i32.shl
      i32.store
      local.get 2
      i32.const 4
      i32.add
      i32.const 1
      local.get 1
      i32.const 4
      call $oggpack_read
      i32.shl
      local.tee 4
      i32.store
      block  ;; label = @2
        local.get 0
        i32.load offset=8
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 0
        i32.load offset=4
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 2
        i32.load
        local.tee 2
        i32.const 64
        i32.lt_s
        br_if 0 (;@2;)
        local.get 4
        local.get 2
        i32.lt_s
        br_if 0 (;@2;)
        local.get 4
        i32.const 8192
        i32.gt_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 4
        local.get 1
        i32.const 1
        call $oggpack_read
        i32.const 1
        i32.eq
        br_if 1 (;@1;)
      end
      local.get 0
      call $vorbis_info_clear
      i32.const -133
      local.set 4
    end
    local.get 4)
  (func $_vorbis_unpack_comment (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32)
    block  ;; label = @1
      block  ;; label = @2
        local.get 1
        i32.const 32
        call $oggpack_read
        local.tee 2
        i32.const 0
        i32.lt_s
        br_if 0 (;@2;)
        local.get 2
        local.get 1
        i32.load offset=16
        local.get 1
        i32.load offset=4
        i32.const 7
        i32.add
        i32.const 8
        i32.div_s
        local.get 1
        i32.load
        i32.add
        i32.sub
        i32.gt_s
        br_if 0 (;@2;)
        local.get 0
        local.get 2
        i32.const 1
        i32.add
        i32.const 1
        call $calloc
        local.tee 3
        i32.store offset=12
        local.get 3
        i32.eqz
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 2
          i32.eqz
          br_if 0 (;@3;)
          loop  ;; label = @4
            local.get 3
            local.get 1
            i32.const 8
            call $oggpack_read
            i32.store8
            local.get 3
            i32.const 1
            i32.add
            local.set 3
            local.get 2
            i32.const -1
            i32.add
            local.tee 2
            br_if 0 (;@4;)
          end
        end
        local.get 1
        i32.const 32
        call $oggpack_read
        local.tee 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 3
        local.get 1
        i32.load offset=16
        local.get 1
        i32.load offset=4
        i32.const 7
        i32.add
        i32.const 8
        i32.div_s
        local.get 1
        i32.load
        i32.add
        i32.sub
        i32.const 2
        i32.shr_s
        i32.gt_s
        br_if 0 (;@2;)
        local.get 0
        local.get 3
        i32.const 1
        i32.add
        local.tee 2
        i32.const 4
        call $calloc
        local.tee 4
        i32.store
        local.get 0
        local.get 2
        i32.const 4
        call $calloc
        local.tee 2
        i32.store offset=4
        local.get 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        local.get 3
        i32.store offset=8
        block  ;; label = @3
          local.get 3
          i32.eqz
          br_if 0 (;@3;)
          i32.const 0
          local.set 4
          loop  ;; label = @4
            local.get 1
            i32.const 32
            call $oggpack_read
            local.tee 2
            i32.const 0
            i32.lt_s
            br_if 2 (;@2;)
            local.get 2
            local.get 1
            i32.load offset=16
            local.get 1
            i32.load offset=4
            i32.const 7
            i32.add
            i32.const 8
            i32.div_s
            local.get 1
            i32.load
            i32.add
            i32.sub
            i32.gt_s
            br_if 2 (;@2;)
            local.get 0
            i32.load offset=4
            local.get 4
            i32.const 2
            i32.shl
            local.tee 3
            i32.add
            local.get 2
            i32.store
            local.get 2
            i32.const 1
            i32.add
            i32.const 1
            call $calloc
            local.set 5
            local.get 0
            i32.load
            local.get 3
            i32.add
            local.get 5
            i32.store
            block  ;; label = @5
              local.get 0
              i32.load
              local.get 3
              i32.add
              i32.load
              local.tee 3
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i32.store offset=8
              br 3 (;@2;)
            end
            block  ;; label = @5
              local.get 2
              i32.eqz
              br_if 0 (;@5;)
              loop  ;; label = @6
                local.get 3
                local.get 1
                i32.const 8
                call $oggpack_read
                i32.store8
                local.get 3
                i32.const 1
                i32.add
                local.set 3
                local.get 2
                i32.const -1
                i32.add
                local.tee 2
                br_if 0 (;@6;)
              end
            end
            local.get 4
            i32.const 1
            i32.add
            local.tee 4
            local.get 0
            i32.load offset=8
            i32.lt_s
            br_if 0 (;@4;)
          end
        end
        i32.const 0
        local.set 3
        local.get 1
        i32.const 1
        call $oggpack_read
        i32.const 1
        i32.eq
        br_if 1 (;@1;)
      end
      local.get 0
      call $vorbis_comment_clear
      i32.const -133
      local.set 3
    end
    local.get 3)
  (func $_vorbis_unpack_books (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.load offset=28
    local.tee 2
    local.get 1
    i32.const 8
    call $oggpack_read
    local.tee 3
    i32.const 1
    i32.add
    i32.store offset=28
    block  ;; label = @1
      block  ;; label = @2
        local.get 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        i32.const 0
        local.set 4
        block  ;; label = @3
          block  ;; label = @4
            loop  ;; label = @5
              i32.const 1
              i32.const 36
              call $calloc
              local.set 5
              local.get 1
              i32.const 24
              call $oggpack_read
              i32.const 5653314
              i32.ne
              br_if 1 (;@4;)
              local.get 5
              local.get 1
              i32.const 16
              call $oggpack_read
              local.tee 3
              i32.store
              local.get 5
              local.get 1
              i32.const 24
              call $oggpack_read
              local.tee 6
              i32.store offset=4
              local.get 6
              i32.const -1
              i32.eq
              br_if 1 (;@4;)
              i32.const 0
              local.set 7
              i32.const 0
              local.set 8
              block  ;; label = @6
                local.get 3
                i32.eqz
                br_if 0 (;@6;)
                i32.const 0
                local.set 8
                loop  ;; label = @7
                  local.get 8
                  i32.const 1
                  i32.add
                  local.set 8
                  local.get 3
                  i32.const 1
                  i32.gt_u
                  local.set 9
                  local.get 3
                  i32.const 1
                  i32.shr_u
                  local.set 3
                  local.get 9
                  br_if 0 (;@7;)
                end
              end
              block  ;; label = @6
                local.get 6
                i32.eqz
                br_if 0 (;@6;)
                i32.const 0
                local.set 7
                local.get 6
                local.set 3
                loop  ;; label = @7
                  local.get 7
                  i32.const 1
                  i32.add
                  local.set 7
                  local.get 3
                  i32.const 1
                  i32.gt_u
                  local.set 9
                  local.get 3
                  i32.const 1
                  i32.shr_u
                  local.set 3
                  local.get 9
                  br_if 0 (;@7;)
                end
              end
              local.get 7
              local.get 8
              i32.add
              i32.const 24
              i32.gt_s
              br_if 1 (;@4;)
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 1
                    i32.const 1
                    call $oggpack_read
                    br_table 0 (;@8;) 1 (;@7;) 4 (;@4;)
                  end
                  i32.const 1
                  i32.const 5
                  local.get 1
                  i32.const 1
                  call $oggpack_read
                  local.tee 7
                  select
                  local.get 6
                  i32.mul
                  i32.const 7
                  i32.add
                  i32.const 3
                  i32.shr_s
                  local.get 1
                  i32.load offset=16
                  local.get 1
                  i32.load offset=4
                  i32.const 7
                  i32.add
                  i32.const 8
                  i32.div_s
                  local.get 1
                  i32.load
                  i32.add
                  i32.sub
                  i32.gt_s
                  br_if 3 (;@4;)
                  local.get 5
                  local.get 6
                  i32.const 2
                  i32.shl
                  call $malloc
                  local.tee 3
                  i32.store offset=8
                  block  ;; label = @8
                    local.get 7
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 6
                    i32.const 1
                    i32.lt_s
                    br_if 2 (;@6;)
                    i32.const 0
                    local.set 8
                    loop  ;; label = @9
                      i32.const 0
                      local.set 7
                      block  ;; label = @10
                        local.get 1
                        i32.const 1
                        call $oggpack_read
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 1
                        i32.const 5
                        call $oggpack_read
                        local.tee 7
                        i32.const -1
                        i32.eq
                        br_if 6 (;@4;)
                        local.get 7
                        i32.const 1
                        i32.add
                        local.set 7
                      end
                      local.get 3
                      local.get 7
                      i32.store
                      local.get 3
                      i32.const 4
                      i32.add
                      local.set 3
                      local.get 8
                      i32.const 1
                      i32.add
                      local.tee 8
                      local.get 5
                      i32.load offset=4
                      i32.lt_s
                      br_if 0 (;@9;)
                      br 3 (;@6;)
                    end
                  end
                  local.get 6
                  i32.const 1
                  i32.lt_s
                  br_if 1 (;@6;)
                  i32.const 0
                  local.set 7
                  loop  ;; label = @8
                    local.get 1
                    i32.const 5
                    call $oggpack_read
                    local.tee 8
                    i32.const -1
                    i32.eq
                    br_if 4 (;@4;)
                    local.get 3
                    local.get 8
                    i32.const 1
                    i32.add
                    i32.store
                    local.get 3
                    i32.const 4
                    i32.add
                    local.set 3
                    local.get 7
                    i32.const 1
                    i32.add
                    local.tee 7
                    local.get 5
                    i32.load offset=4
                    i32.lt_s
                    br_if 0 (;@8;)
                    br 2 (;@6;)
                  end
                end
                local.get 1
                i32.const 5
                call $oggpack_read
                i32.const 1
                i32.add
                local.tee 7
                i32.eqz
                br_if 2 (;@4;)
                local.get 5
                local.get 6
                i32.const 2
                i32.shl
                call $malloc
                local.tee 10
                i32.store offset=8
                local.get 6
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                i32.const 0
                local.set 11
                loop  ;; label = @7
                  i32.const 0
                  local.set 8
                  block  ;; label = @8
                    local.get 6
                    local.get 11
                    i32.sub
                    local.tee 3
                    i32.eqz
                    br_if 0 (;@8;)
                    i32.const 0
                    local.set 8
                    loop  ;; label = @9
                      local.get 8
                      i32.const 1
                      i32.add
                      local.set 8
                      local.get 3
                      i32.const 1
                      i32.gt_u
                      local.set 9
                      local.get 3
                      i32.const 1
                      i32.shr_u
                      local.set 3
                      local.get 9
                      br_if 0 (;@9;)
                    end
                  end
                  local.get 1
                  local.get 8
                  call $oggpack_read
                  local.tee 9
                  i32.const -1
                  i32.eq
                  br_if 3 (;@4;)
                  local.get 7
                  i32.const 32
                  i32.gt_s
                  br_if 3 (;@4;)
                  local.get 9
                  local.get 5
                  i32.load offset=4
                  local.tee 6
                  local.get 11
                  i32.sub
                  i32.gt_s
                  br_if 3 (;@4;)
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 9
                      i32.const 0
                      i32.gt_s
                      br_if 0 (;@9;)
                      local.get 7
                      i32.const 1
                      i32.add
                      local.set 7
                      br 1 (;@8;)
                    end
                    local.get 9
                    i32.const -1
                    i32.add
                    local.get 7
                    i32.const 1
                    i32.shr_s
                    i32.shr_u
                    local.get 7
                    i32.const 1
                    i32.add
                    local.tee 12
                    i32.const 1
                    i32.shr_s
                    i32.shr_u
                    br_if 4 (;@4;)
                    local.get 11
                    local.set 13
                    block  ;; label = @9
                      local.get 9
                      i32.const 7
                      i32.and
                      local.tee 8
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 11
                      local.get 8
                      i32.add
                      local.set 13
                      local.get 10
                      local.get 11
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set 3
                      loop  ;; label = @10
                        local.get 3
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 4
                        i32.add
                        local.set 3
                        local.get 8
                        i32.const -1
                        i32.add
                        local.tee 8
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 9
                    local.get 11
                    i32.add
                    local.set 11
                    block  ;; label = @9
                      local.get 9
                      i32.const 8
                      i32.lt_u
                      br_if 0 (;@9;)
                      local.get 9
                      i32.const -8
                      i32.and
                      local.set 8
                      local.get 10
                      local.get 13
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set 3
                      loop  ;; label = @10
                        local.get 3
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 28
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 24
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 20
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 16
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 12
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 8
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 4
                        i32.add
                        local.get 7
                        i32.store
                        local.get 3
                        i32.const 32
                        i32.add
                        local.set 3
                        local.get 8
                        i32.const -8
                        i32.add
                        local.tee 8
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 12
                    local.set 7
                  end
                  local.get 11
                  local.get 6
                  i32.lt_s
                  br_if 0 (;@7;)
                end
              end
              local.get 5
              local.get 1
              i32.const 4
              call $oggpack_read
              local.tee 3
              i32.store offset=12
              block  ;; label = @6
                block  ;; label = @7
                  local.get 3
                  br_table 1 (;@6;) 0 (;@7;) 0 (;@7;) 3 (;@4;)
                end
                local.get 5
                local.get 1
                i32.const 32
                call $oggpack_read
                i32.store offset=16
                local.get 5
                local.get 1
                i32.const 32
                call $oggpack_read
                i32.store offset=20
                local.get 5
                local.get 1
                i32.const 4
                call $oggpack_read
                i32.const 1
                i32.add
                local.tee 8
                i32.store offset=24
                local.get 5
                local.get 1
                i32.const 1
                call $oggpack_read
                local.tee 7
                i32.store offset=28
                local.get 7
                i32.const -1
                i32.eq
                br_if 2 (;@4;)
                i32.const 0
                local.set 7
                block  ;; label = @7
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 3
                      i32.const -1
                      i32.add
                      br_table 0 (;@9;) 1 (;@8;) 2 (;@7;)
                    end
                    local.get 5
                    i32.load
                    i32.eqz
                    br_if 1 (;@7;)
                    local.get 5
                    call $_book_maptype1_quantvals
                    local.set 7
                    br 1 (;@7;)
                  end
                  local.get 5
                  i32.load
                  local.get 5
                  i32.load offset=4
                  i32.mul
                  local.set 7
                end
                local.get 8
                local.get 7
                i32.mul
                i32.const 7
                i32.add
                i32.const 3
                i32.shr_s
                local.get 1
                i32.load offset=16
                local.get 1
                i32.load offset=4
                i32.const 7
                i32.add
                i32.const 8
                i32.div_s
                local.get 1
                i32.load
                i32.add
                i32.sub
                i32.gt_s
                br_if 2 (;@4;)
                local.get 5
                local.get 7
                i32.const 2
                i32.shl
                local.tee 11
                call $malloc
                local.tee 9
                i32.store offset=32
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 7
                    i32.const 1
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 5
                    i32.load offset=24
                    local.set 8
                    local.get 9
                    local.set 3
                    loop  ;; label = @9
                      local.get 3
                      local.get 1
                      local.get 8
                      call $oggpack_read
                      i32.store
                      local.get 3
                      i32.const 4
                      i32.add
                      local.set 3
                      local.get 7
                      i32.const -1
                      i32.add
                      local.tee 7
                      br_if 0 (;@9;)
                      br 2 (;@7;)
                    end
                  end
                  local.get 7
                  i32.eqz
                  br_if 1 (;@6;)
                end
                local.get 9
                local.get 11
                i32.add
                i32.const -4
                i32.add
                i32.load
                i32.const -1
                i32.eq
                br_if 2 (;@4;)
              end
              local.get 2
              local.get 4
              i32.const 2
              i32.shl
              i32.add
              i32.const 2080
              i32.add
              local.get 5
              i32.store
              local.get 4
              i32.const 1
              i32.add
              local.tee 4
              local.get 2
              i32.load offset=28
              i32.ge_s
              br_if 2 (;@3;)
              br 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 5
            i32.load offset=32
            local.tee 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 3
            call $free
          end
          block  ;; label = @4
            local.get 5
            i32.load offset=8
            local.tee 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 3
            call $free
          end
          local.get 5
          call $free
          local.get 2
          local.get 4
          i32.const 2
          i32.shl
          i32.add
          i32.const 2080
          i32.add
          i32.const 0
          i32.store
          br 1 (;@2;)
        end
        local.get 2
        local.get 1
        i32.const 6
        call $oggpack_read
        local.tee 3
        i32.const 1
        i32.add
        i32.store offset=16
        local.get 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 2
        i32.const 800
        i32.add
        local.set 3
        i32.const 0
        local.set 8
        loop  ;; label = @3
          local.get 3
          local.get 1
          i32.const 16
          call $oggpack_read
          local.tee 7
          i32.store
          local.get 7
          br_if 1 (;@2;)
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 8
          i32.const 1
          i32.add
          local.tee 8
          local.get 2
          i32.load offset=16
          i32.lt_s
          br_if 0 (;@3;)
        end
        local.get 2
        local.get 1
        i32.const 6
        call $oggpack_read
        local.tee 3
        i32.const 1
        i32.add
        i32.store offset=20
        local.get 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 2
        i32.const 1312
        i32.add
        local.set 3
        i32.const 0
        local.set 8
        loop  ;; label = @3
          local.get 3
          i32.const -256
          i32.add
          local.get 1
          i32.const 16
          call $oggpack_read
          local.tee 7
          i32.store
          local.get 7
          i32.const 1
          i32.gt_u
          br_if 1 (;@2;)
          local.get 3
          local.get 0
          local.get 1
          local.get 7
          i32.const 2
          i32.shl
          i32.const 16789992
          i32.add
          i32.load
          i32.load
          call_indirect (type 5)
          local.tee 7
          i32.store
          local.get 7
          i32.eqz
          br_if 1 (;@2;)
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 8
          i32.const 1
          i32.add
          local.tee 8
          local.get 2
          i32.load offset=20
          i32.lt_s
          br_if 0 (;@3;)
        end
        local.get 2
        local.get 1
        i32.const 6
        call $oggpack_read
        local.tee 3
        i32.const 1
        i32.add
        i32.store offset=24
        local.get 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 2
        i32.const 1824
        i32.add
        local.set 3
        i32.const 0
        local.set 8
        loop  ;; label = @3
          local.get 3
          i32.const -256
          i32.add
          local.get 1
          i32.const 16
          call $oggpack_read
          local.tee 7
          i32.store
          local.get 7
          i32.const 2
          i32.gt_u
          br_if 1 (;@2;)
          local.get 3
          local.get 0
          local.get 1
          local.get 7
          i32.const 2
          i32.shl
          i32.const 16790000
          i32.add
          i32.load
          i32.load
          call_indirect (type 5)
          local.tee 7
          i32.store
          local.get 7
          i32.eqz
          br_if 1 (;@2;)
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 8
          i32.const 1
          i32.add
          local.tee 8
          local.get 2
          i32.load offset=24
          i32.lt_s
          br_if 0 (;@3;)
        end
        local.get 2
        local.get 1
        i32.const 6
        call $oggpack_read
        local.tee 3
        i32.const 1
        i32.add
        i32.store offset=12
        local.get 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 2
        i32.const 544
        i32.add
        local.set 3
        i32.const 0
        local.set 8
        loop  ;; label = @3
          local.get 3
          i32.const -256
          i32.add
          local.get 1
          i32.const 16
          call $oggpack_read
          local.tee 7
          i32.store
          local.get 7
          br_if 1 (;@2;)
          local.get 3
          local.get 0
          local.get 1
          call $mapping0_unpack
          local.tee 7
          i32.store
          local.get 7
          i32.eqz
          br_if 1 (;@2;)
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 8
          i32.const 1
          i32.add
          local.tee 8
          local.get 2
          i32.load offset=12
          i32.lt_s
          br_if 0 (;@3;)
        end
        local.get 2
        local.get 1
        i32.const 6
        call $oggpack_read
        local.tee 3
        i32.const 1
        i32.add
        i32.store offset=8
        local.get 3
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 2
        i32.const 32
        i32.add
        local.set 3
        i32.const 0
        local.set 9
        loop  ;; label = @3
          local.get 3
          i32.const 1
          i32.const 16
          call $calloc
          i32.store
          local.get 1
          i32.const 1
          call $oggpack_read
          local.set 7
          local.get 3
          i32.load
          local.get 7
          i32.store
          local.get 1
          i32.const 16
          call $oggpack_read
          local.set 7
          local.get 3
          i32.load
          local.get 7
          i32.store offset=4
          local.get 1
          i32.const 16
          call $oggpack_read
          local.set 7
          local.get 3
          i32.load
          local.get 7
          i32.store offset=8
          local.get 1
          i32.const 8
          call $oggpack_read
          local.set 7
          local.get 3
          i32.load
          local.tee 8
          local.get 7
          i32.store offset=12
          local.get 8
          i32.load offset=4
          i32.const 0
          i32.gt_s
          br_if 1 (;@2;)
          local.get 8
          i32.load offset=8
          i32.const 0
          i32.gt_s
          br_if 1 (;@2;)
          local.get 7
          i32.const 0
          i32.lt_s
          br_if 1 (;@2;)
          local.get 7
          local.get 2
          i32.load offset=12
          i32.ge_s
          br_if 1 (;@2;)
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 9
          i32.const 1
          i32.add
          local.tee 9
          local.get 2
          i32.load offset=8
          i32.lt_s
          br_if 0 (;@3;)
        end
        i32.const 0
        local.set 3
        local.get 1
        i32.const 1
        call $oggpack_read
        i32.const 1
        i32.eq
        br_if 1 (;@1;)
      end
      local.get 0
      call $vorbis_info_clear
      i32.const -133
      local.set 3
    end
    local.get 3)
  (func $oggpack_read (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32)
    block  ;; label = @1
      block  ;; label = @2
        local.get 1
        i32.const 33
        i32.lt_u
        br_if 0 (;@2;)
        local.get 0
        i32.load offset=16
        local.set 1
        br 1 (;@1;)
      end
      local.get 0
      i32.load offset=4
      local.tee 2
      local.get 1
      i32.add
      local.set 3
      local.get 1
      i32.const 2
      i32.shl
      i32.const 16798208
      i32.add
      i32.load
      local.set 4
      block  ;; label = @2
        local.get 0
        i32.load
        local.tee 5
        local.get 0
        i32.load offset=16
        local.tee 1
        i32.const -4
        i32.add
        i32.lt_s
        br_if 0 (;@2;)
        local.get 5
        local.get 1
        local.get 3
        i32.const 7
        i32.add
        i32.const 3
        i32.shr_s
        i32.sub
        i32.gt_s
        br_if 1 (;@1;)
        local.get 3
        br_if 0 (;@2;)
        i32.const 0
        return
      end
      local.get 0
      i32.load offset=12
      local.tee 6
      i32.load8_u
      local.get 2
      i32.shr_u
      local.set 1
      block  ;; label = @2
        local.get 3
        i32.const 9
        i32.lt_s
        br_if 0 (;@2;)
        local.get 6
        i32.const 1
        i32.add
        i32.load8_u
        i32.const 8
        local.get 2
        i32.sub
        i32.shl
        local.get 1
        i32.or
        local.set 1
        local.get 3
        i32.const 17
        i32.lt_u
        br_if 0 (;@2;)
        local.get 6
        i32.const 2
        i32.add
        i32.load8_u
        i32.const 16
        local.get 2
        i32.sub
        i32.shl
        local.get 1
        i32.or
        local.set 1
        local.get 3
        i32.const 25
        i32.lt_u
        br_if 0 (;@2;)
        local.get 6
        i32.const 3
        i32.add
        i32.load8_u
        i32.const 24
        local.get 2
        i32.sub
        i32.shl
        local.get 1
        i32.or
        local.set 1
        local.get 2
        i32.eqz
        br_if 0 (;@2;)
        local.get 3
        i32.const 33
        i32.lt_u
        br_if 0 (;@2;)
        local.get 6
        i32.const 4
        i32.add
        i32.load8_u
        i32.const 32
        local.get 2
        i32.sub
        i32.shl
        local.get 1
        i32.or
        local.set 1
      end
      local.get 0
      local.get 3
      i32.const 7
      i32.and
      i32.store offset=4
      local.get 0
      local.get 3
      i32.const 8
      i32.div_s
      local.tee 3
      local.get 5
      i32.add
      i32.store
      local.get 0
      local.get 6
      local.get 3
      i32.add
      i32.store offset=12
      local.get 1
      local.get 4
      i32.and
      return
    end
    local.get 0
    i32.const 1
    i32.store offset=4
    local.get 0
    local.get 1
    i32.store
    local.get 0
    i32.const 0
    i32.store offset=12
    i32.const -1)
  (func $_book_maptype1_quantvals (type 1) (param i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    i32.const 0
    local.set 1
    block  ;; label = @1
      local.get 0
      i32.load offset=4
      local.tee 2
      i32.eqz
      br_if 0 (;@1;)
      i32.const -1
      local.set 3
      local.get 2
      local.set 4
      loop  ;; label = @2
        local.get 3
        i32.const 1
        i32.add
        local.set 3
        local.get 4
        i32.const 1
        i32.gt_u
        local.set 5
        local.get 4
        i32.const 1
        i32.shr_u
        local.set 4
        local.get 5
        br_if 0 (;@2;)
      end
      local.get 2
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 2
      local.get 0
      i32.load
      local.tee 6
      i32.const -1
      i32.add
      local.get 3
      i32.mul
      local.get 6
      i32.div_s
      i32.shr_u
      local.set 1
      loop  ;; label = @2
        i32.const 1
        local.set 4
        i32.const 1
        local.set 3
        block  ;; label = @3
          local.get 6
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 1
          local.set 3
          local.get 1
          i32.const 1
          i32.add
          local.set 5
          local.get 2
          local.get 1
          i32.div_s
          local.set 7
          local.get 6
          local.set 0
          i32.const 1
          local.set 4
          loop  ;; label = @4
            block  ;; label = @5
              local.get 7
              local.get 4
              i32.ge_s
              br_if 0 (;@5;)
              local.get 1
              i32.const -1
              i32.add
              local.set 1
              br 3 (;@2;)
            end
            i32.const 2147483647
            local.get 3
            local.get 5
            i32.mul
            i32.const 2147483647
            local.get 5
            i32.div_s
            local.get 3
            i32.lt_s
            select
            local.set 3
            local.get 4
            local.get 1
            i32.mul
            local.set 4
            local.get 0
            i32.const -1
            i32.add
            local.tee 0
            br_if 0 (;@4;)
          end
        end
        block  ;; label = @3
          local.get 4
          local.get 2
          i32.gt_s
          local.tee 4
          br_if 0 (;@3;)
          local.get 3
          local.get 2
          i32.gt_s
          br_if 2 (;@1;)
        end
        local.get 1
        i32.const -1
        i32.const 1
        local.get 4
        select
        i32.add
        local.set 1
        br 0 (;@2;)
      end
    end
    local.get 1)
  (func $mapping0_unpack (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32)
    i32.const 1
    i32.const 3216
    call $calloc
    local.set 2
    local.get 0
    i32.load offset=28
    local.set 3
    block  ;; label = @1
      local.get 1
      i32.const 1
      call $oggpack_read
      local.tee 4
      i32.const 0
      i32.lt_s
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 4
          i32.eqz
          br_if 0 (;@3;)
          local.get 2
          local.get 1
          i32.const 4
          call $oggpack_read
          local.tee 4
          i32.const 1
          i32.add
          i32.store
          local.get 4
          i32.const 2147483646
          i32.le_u
          br_if 1 (;@2;)
          br 2 (;@1;)
        end
        local.get 2
        i32.const 1
        i32.store
      end
      local.get 1
      i32.const 1
      call $oggpack_read
      local.tee 4
      i32.const 0
      i32.lt_s
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 4
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        local.get 1
        i32.const 8
        call $oggpack_read
        local.tee 4
        i32.const 1
        i32.add
        i32.store offset=1164
        local.get 4
        i32.const 2147483646
        i32.gt_u
        br_if 1 (;@1;)
        local.get 0
        i32.load offset=4
        local.set 5
        i32.const 0
        local.set 6
        loop  ;; label = @3
          i32.const 0
          local.set 7
          block  ;; label = @4
            local.get 5
            i32.const 2
            i32.lt_u
            br_if 0 (;@4;)
            local.get 5
            i32.const -1
            i32.add
            local.set 4
            i32.const 0
            local.set 7
            loop  ;; label = @5
              local.get 7
              i32.const 1
              i32.add
              local.set 7
              local.get 4
              i32.const 1
              i32.gt_u
              local.set 5
              local.get 4
              i32.const 1
              i32.shr_u
              local.set 4
              local.get 5
              br_if 0 (;@5;)
            end
          end
          local.get 2
          local.get 6
          i32.const 2
          i32.shl
          i32.add
          local.tee 8
          i32.const 1168
          i32.add
          local.get 1
          local.get 7
          call $oggpack_read
          local.tee 9
          i32.store
          i32.const 0
          local.set 7
          block  ;; label = @4
            local.get 0
            i32.load offset=4
            local.tee 4
            i32.const 2
            i32.lt_u
            br_if 0 (;@4;)
            local.get 4
            i32.const -1
            i32.add
            local.set 4
            i32.const 0
            local.set 7
            loop  ;; label = @5
              local.get 7
              i32.const 1
              i32.add
              local.set 7
              local.get 4
              i32.const 1
              i32.gt_u
              local.set 5
              local.get 4
              i32.const 1
              i32.shr_u
              local.set 4
              local.get 5
              br_if 0 (;@5;)
            end
          end
          local.get 8
          i32.const 2192
          i32.add
          local.get 1
          local.get 7
          call $oggpack_read
          local.tee 4
          i32.store
          local.get 9
          i32.const 0
          i32.lt_s
          br_if 2 (;@1;)
          local.get 4
          i32.const 0
          i32.lt_s
          br_if 2 (;@1;)
          local.get 9
          local.get 4
          i32.eq
          br_if 2 (;@1;)
          local.get 9
          local.get 0
          i32.load offset=4
          local.tee 5
          i32.ge_s
          br_if 2 (;@1;)
          local.get 4
          local.get 5
          i32.ge_s
          br_if 2 (;@1;)
          local.get 6
          i32.const 1
          i32.add
          local.tee 6
          local.get 2
          i32.load offset=1164
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 1
      i32.const 2
      call $oggpack_read
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 2
          i32.load
          local.tee 9
          i32.const 2
          i32.lt_s
          br_if 0 (;@3;)
          local.get 0
          i32.load offset=4
          i32.const 1
          i32.lt_s
          br_if 1 (;@2;)
          local.get 2
          i32.const 4
          i32.add
          local.set 4
          i32.const 0
          local.set 5
          loop  ;; label = @4
            local.get 4
            local.get 1
            i32.const 4
            call $oggpack_read
            local.tee 7
            i32.store
            local.get 7
            i32.const 0
            i32.lt_s
            br_if 3 (;@1;)
            local.get 7
            local.get 2
            i32.load
            local.tee 9
            i32.ge_s
            br_if 3 (;@1;)
            local.get 4
            i32.const 4
            i32.add
            local.set 4
            local.get 5
            i32.const 1
            i32.add
            local.tee 5
            local.get 0
            i32.load offset=4
            i32.lt_s
            br_if 0 (;@4;)
          end
        end
        local.get 9
        i32.const 1
        i32.ge_s
        br_if 0 (;@2;)
        local.get 2
        return
      end
      local.get 2
      i32.const 1092
      i32.add
      local.set 4
      i32.const 0
      local.set 5
      loop  ;; label = @2
        local.get 1
        i32.const 8
        call $oggpack_read
        local.get 3
        i32.load offset=16
        i32.ge_s
        br_if 1 (;@1;)
        local.get 4
        i32.const -64
        i32.add
        local.get 1
        i32.const 8
        call $oggpack_read
        local.tee 7
        i32.store
        local.get 7
        i32.const 0
        i32.lt_s
        br_if 1 (;@1;)
        local.get 7
        local.get 3
        i32.load offset=20
        i32.ge_s
        br_if 1 (;@1;)
        local.get 4
        local.get 1
        i32.const 8
        call $oggpack_read
        local.tee 7
        i32.store
        local.get 7
        i32.const 0
        i32.lt_s
        br_if 1 (;@1;)
        local.get 7
        local.get 3
        i32.load offset=24
        i32.ge_s
        br_if 1 (;@1;)
        local.get 4
        i32.const 4
        i32.add
        local.set 4
        local.get 5
        i32.const 1
        i32.add
        local.tee 5
        local.get 2
        i32.load
        i32.lt_s
        br_if 0 (;@2;)
      end
      local.get 2
      return
    end
    local.get 2
    call $free
    i32.const 0)
  (func $floor1_unpack (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 272
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 0
    i32.load offset=28
    local.set 3
    i32.const 1
    i32.const 1096
    call $calloc
    local.tee 4
    local.get 1
    i32.const 5
    call $oggpack_read
    local.tee 0
    i32.store
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          local.get 4
          i32.const 4
          i32.add
          local.set 5
          i32.const -1
          local.set 6
          i32.const 0
          local.set 7
          loop  ;; label = @4
            local.get 5
            local.get 1
            i32.const 4
            call $oggpack_read
            local.tee 0
            i32.store
            local.get 0
            i32.const 0
            i32.lt_s
            br_if 2 (;@2;)
            local.get 6
            local.get 0
            local.get 6
            local.get 0
            i32.gt_s
            select
            local.set 6
            local.get 5
            i32.const 4
            i32.add
            local.set 5
            local.get 7
            i32.const 1
            i32.add
            local.tee 7
            local.get 4
            i32.load
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 6
          i32.const 2147483646
          i32.gt_u
          br_if 0 (;@3;)
          local.get 4
          i32.const 320
          i32.add
          local.set 8
          i32.const 0
          local.set 9
          loop  ;; label = @4
            local.get 4
            local.get 9
            i32.const 2
            i32.shl
            i32.add
            local.tee 5
            i32.const 128
            i32.add
            local.get 1
            i32.const 3
            call $oggpack_read
            i32.const 1
            i32.add
            i32.store
            local.get 5
            i32.const 192
            i32.add
            local.tee 10
            local.get 1
            i32.const 2
            call $oggpack_read
            local.tee 0
            i32.store
            local.get 0
            i32.const 0
            i32.lt_s
            br_if 2 (;@2;)
            block  ;; label = @5
              block  ;; label = @6
                local.get 0
                br_if 0 (;@6;)
                local.get 5
                i32.const 256
                i32.add
                i32.load
                local.set 5
                br 1 (;@5;)
              end
              local.get 5
              i32.const 256
              i32.add
              local.get 1
              i32.const 8
              call $oggpack_read
              local.tee 5
              i32.store
            end
            local.get 5
            i32.const 0
            i32.lt_s
            br_if 2 (;@2;)
            local.get 5
            local.get 3
            i32.load offset=28
            i32.ge_s
            br_if 2 (;@2;)
            block  ;; label = @5
              local.get 0
              i32.const 31
              i32.eq
              br_if 0 (;@5;)
              i32.const 0
              local.set 11
              local.get 8
              local.set 0
              loop  ;; label = @6
                local.get 0
                local.get 1
                i32.const 8
                call $oggpack_read
                local.tee 5
                i32.const -1
                i32.add
                local.tee 7
                i32.store
                local.get 5
                i32.const -2147483648
                i32.gt_u
                br_if 4 (;@2;)
                local.get 7
                local.get 3
                i32.load offset=28
                i32.ge_s
                br_if 4 (;@2;)
                local.get 0
                i32.const 4
                i32.add
                local.set 0
                local.get 11
                i32.const 1
                i32.add
                local.tee 11
                i32.const 1
                local.get 10
                i32.load
                i32.shl
                i32.lt_s
                br_if 0 (;@6;)
              end
            end
            local.get 8
            i32.const 32
            i32.add
            local.set 8
            local.get 9
            local.get 6
            i32.ne
            local.set 0
            local.get 9
            i32.const 1
            i32.add
            local.set 9
            local.get 0
            br_if 0 (;@4;)
          end
        end
        local.get 4
        local.get 1
        i32.const 2
        call $oggpack_read
        i32.const 1
        i32.add
        i32.store offset=832
        local.get 1
        i32.const 4
        call $oggpack_read
        local.tee 7
        i32.const 0
        i32.lt_s
        br_if 0 (;@2;)
        i32.const 1
        local.get 7
        i32.shl
        local.set 11
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              local.get 4
              i32.load
              local.tee 0
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 4
              i32.const 844
              i32.add
              local.set 8
              i32.const 0
              local.set 10
              i32.const 0
              local.set 5
              i32.const 0
              local.set 6
              loop  ;; label = @6
                local.get 4
                local.get 4
                local.get 10
                i32.const 2
                i32.shl
                i32.add
                i32.const 4
                i32.add
                i32.load
                i32.const 2
                i32.shl
                i32.add
                i32.const 128
                i32.add
                i32.load
                local.tee 9
                local.get 6
                i32.add
                local.tee 3
                i32.const 63
                i32.gt_s
                br_if 4 (;@2;)
                block  ;; label = @7
                  local.get 5
                  local.get 3
                  i32.ge_s
                  br_if 0 (;@7;)
                  local.get 8
                  local.get 5
                  i32.const 2
                  i32.shl
                  i32.add
                  local.set 0
                  local.get 9
                  local.get 6
                  i32.add
                  local.get 5
                  i32.sub
                  local.set 5
                  loop  ;; label = @8
                    local.get 0
                    local.get 1
                    local.get 7
                    call $oggpack_read
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.const 0
                    i32.lt_s
                    br_if 6 (;@2;)
                    local.get 6
                    local.get 11
                    i32.ge_s
                    br_if 6 (;@2;)
                    local.get 0
                    i32.const 4
                    i32.add
                    local.set 0
                    local.get 5
                    i32.const -1
                    i32.add
                    local.tee 5
                    br_if 0 (;@8;)
                  end
                  local.get 4
                  i32.load
                  local.set 0
                  local.get 3
                  local.set 5
                end
                local.get 3
                local.set 6
                local.get 10
                i32.const 1
                i32.add
                local.tee 10
                local.get 0
                i32.lt_s
                br_if 0 (;@6;)
              end
              local.get 4
              i32.const 840
              i32.add
              local.get 11
              i32.store
              i32.const 0
              local.set 0
              local.get 4
              i32.const 836
              i32.add
              i32.const 0
              i32.store
              local.get 3
              i32.const 2
              i32.add
              local.set 11
              block  ;; label = @6
                local.get 3
                i32.const -2
                i32.gt_s
                br_if 0 (;@6;)
                local.get 2
                local.get 11
                i32.const 4
                call $qsort
                br 5 (;@1;)
              end
              local.get 11
              i32.const 3
              i32.and
              local.set 5
              block  ;; label = @6
                local.get 11
                i32.const 4
                i32.lt_u
                br_if 0 (;@6;)
                local.get 11
                i32.const 2147483644
                i32.and
                local.set 10
                i32.const 0
                local.set 6
                i32.const 0
                local.set 0
                loop  ;; label = @7
                  local.get 2
                  local.get 6
                  i32.add
                  local.tee 1
                  i32.const 12
                  i32.add
                  local.get 4
                  local.get 6
                  i32.add
                  local.tee 7
                  i32.const 848
                  i32.add
                  i32.store
                  local.get 1
                  i32.const 8
                  i32.add
                  local.get 7
                  i32.const 844
                  i32.add
                  i32.store
                  local.get 1
                  i32.const 4
                  i32.add
                  local.get 7
                  i32.const 840
                  i32.add
                  i32.store
                  local.get 1
                  local.get 7
                  i32.const 836
                  i32.add
                  i32.store
                  local.get 6
                  i32.const 16
                  i32.add
                  local.set 6
                  local.get 10
                  local.get 0
                  i32.const 4
                  i32.add
                  local.tee 0
                  i32.ne
                  br_if 0 (;@7;)
                end
              end
              local.get 5
              i32.eqz
              br_if 2 (;@3;)
              br 1 (;@4;)
            end
            local.get 4
            i32.const 840
            i32.add
            local.get 11
            i32.store
            i32.const 0
            local.set 0
            local.get 4
            i32.const 836
            i32.add
            i32.const 0
            i32.store
            i32.const 2
            local.set 11
            i32.const 0
            local.set 3
            i32.const 2
            local.set 5
          end
          local.get 0
          i32.const 2
          i32.shl
          local.tee 6
          local.get 4
          i32.add
          i32.const 836
          i32.add
          local.set 0
          local.get 2
          local.get 6
          i32.add
          local.set 6
          loop  ;; label = @4
            local.get 6
            local.get 0
            i32.store
            local.get 0
            i32.const 4
            i32.add
            local.set 0
            local.get 6
            i32.const 4
            i32.add
            local.set 6
            local.get 5
            i32.const -1
            i32.add
            local.tee 5
            br_if 0 (;@4;)
          end
        end
        local.get 2
        local.get 11
        i32.const 4
        call $qsort
        local.get 3
        i32.const 2147483645
        i32.gt_u
        br_if 1 (;@1;)
        local.get 11
        i32.const -1
        i32.add
        local.set 5
        local.get 2
        i32.const 4
        i32.or
        local.set 0
        local.get 2
        i32.load
        i32.load
        local.set 6
        loop  ;; label = @3
          local.get 6
          local.get 0
          i32.load
          i32.load
          local.tee 1
          i32.eq
          br_if 1 (;@2;)
          local.get 0
          i32.const 4
          i32.add
          local.set 0
          local.get 1
          local.set 6
          local.get 5
          i32.const -1
          i32.add
          local.tee 5
          i32.eqz
          br_if 2 (;@1;)
          br 0 (;@3;)
        end
      end
      local.get 4
      call $free
      i32.const 0
      local.set 4
    end
    local.get 2
    i32.const 272
    i32.add
    global.set $__stack_pointer
    local.get 4)
  (func $floor1_icomp (type 5) (param i32 i32) (result i32)
    local.get 0
    i32.load
    i32.load
    local.get 1
    i32.load
    i32.load
    i32.sub)
  (func $qsort (type 14) (param i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 688
    i32.sub
    local.tee 3
    global.set $__stack_pointer
    block  ;; label = @1
      local.get 1
      i32.const 2
      i32.shl
      local.tee 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 3
      i64.const 17179869188
      i64.store
      local.get 3
      i32.const 8
      i32.or
      local.set 1
      i32.const 4
      local.set 5
      i32.const 4
      local.set 6
      loop  ;; label = @2
        local.get 1
        local.get 6
        local.get 5
        local.tee 7
        i32.add
        i32.const 4
        i32.add
        local.tee 5
        i32.store
        local.get 1
        i32.const 4
        i32.add
        local.set 1
        local.get 7
        local.set 6
        local.get 5
        local.get 4
        i32.lt_u
        br_if 0 (;@2;)
      end
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          local.get 4
          i32.add
          i32.const -4
          i32.add
          local.tee 8
          local.get 0
          i32.gt_u
          br_if 0 (;@3;)
          i32.const 1
          local.set 9
          i32.const 0
          local.set 10
          i32.const 1
          local.set 11
          br 1 (;@2;)
        end
        local.get 3
        i32.const 192
        i32.add
        i32.const 4
        i32.or
        local.set 12
        i32.const 1
        local.set 11
        i32.const 0
        local.set 10
        i32.const 1
        local.set 9
        loop  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              local.get 9
              i32.const 3
              i32.and
              i32.const 3
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 0
              i32.store offset=192
              block  ;; label = @6
                local.get 11
                i32.const 2
                i32.lt_s
                br_if 0 (;@6;)
                i32.const 1
                local.set 4
                local.get 12
                local.set 6
                local.get 0
                local.set 1
                local.get 11
                local.set 5
                block  ;; label = @7
                  loop  ;; label = @8
                    block  ;; label = @9
                      local.get 0
                      local.get 1
                      i32.const -4
                      i32.add
                      local.tee 1
                      local.get 3
                      local.get 5
                      i32.const -2
                      i32.add
                      local.tee 13
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      i32.sub
                      local.tee 7
                      local.get 2
                      call_indirect (type 5)
                      i32.const 0
                      i32.lt_s
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 1
                      local.get 2
                      call_indirect (type 5)
                      i32.const -1
                      i32.gt_s
                      br_if 2 (;@7;)
                    end
                    local.get 6
                    local.get 7
                    local.get 1
                    local.get 7
                    local.get 1
                    local.get 2
                    call_indirect (type 5)
                    i32.const -1
                    i32.gt_s
                    local.tee 14
                    select
                    local.tee 1
                    i32.store
                    local.get 6
                    i32.const 4
                    i32.add
                    local.set 6
                    local.get 4
                    i32.const 1
                    i32.add
                    local.set 4
                    local.get 5
                    i32.const -1
                    i32.add
                    local.get 13
                    local.get 14
                    select
                    local.tee 5
                    i32.const 1
                    i32.gt_u
                    br_if 0 (;@8;)
                  end
                end
                local.get 4
                i32.const 2
                i32.lt_u
                br_if 0 (;@6;)
                local.get 3
                local.get 3
                i32.load offset=192
                local.tee 5
                i32.load align=1
                i32.store offset=432
                local.get 3
                i32.const 192
                i32.add
                local.get 4
                i32.const 2
                i32.shl
                i32.add
                local.get 3
                i32.const 432
                i32.add
                i32.store
                i32.const 0
                local.set 14
                block  ;; label = @7
                  local.get 4
                  i32.const -2
                  i32.add
                  local.tee 15
                  i32.const 2
                  i32.lt_u
                  br_if 0 (;@7;)
                  local.get 15
                  i32.const 1
                  i32.shr_u
                  i32.const 1
                  i32.add
                  i32.const -2
                  i32.and
                  local.set 16
                  i32.const 0
                  local.set 14
                  local.get 3
                  i32.const 192
                  i32.add
                  local.set 1
                  loop  ;; label = @8
                    local.get 5
                    local.get 1
                    i32.const 4
                    i32.add
                    local.tee 17
                    i32.load
                    local.tee 6
                    i32.load align=1
                    i32.store align=1
                    local.get 6
                    local.get 1
                    i32.const 8
                    i32.add
                    local.tee 18
                    i32.load
                    local.tee 7
                    i32.load align=1
                    i32.store align=1
                    local.get 7
                    local.get 1
                    i32.const 12
                    i32.add
                    local.tee 19
                    i32.load
                    local.tee 13
                    i32.load align=1
                    i32.store align=1
                    local.get 1
                    local.get 5
                    i32.const 4
                    i32.add
                    i32.store
                    local.get 18
                    local.get 7
                    i32.const 4
                    i32.add
                    i32.store
                    local.get 17
                    local.get 6
                    i32.const 4
                    i32.add
                    i32.store
                    local.get 19
                    local.get 13
                    i32.const 4
                    i32.add
                    i32.store
                    local.get 13
                    local.get 1
                    i32.const 16
                    i32.add
                    local.tee 1
                    i32.load
                    local.tee 5
                    i32.load align=1
                    i32.store align=1
                    local.get 14
                    i32.const 4
                    i32.add
                    local.set 14
                    local.get 16
                    i32.const -2
                    i32.add
                    local.tee 16
                    br_if 0 (;@8;)
                  end
                end
                block  ;; label = @7
                  local.get 15
                  i32.const 2
                  i32.and
                  br_if 0 (;@7;)
                  local.get 5
                  local.get 3
                  i32.const 192
                  i32.add
                  local.get 14
                  i32.const 2
                  i32.shl
                  i32.add
                  local.tee 6
                  i32.const 4
                  i32.add
                  local.tee 7
                  i32.load
                  local.tee 1
                  i32.load align=1
                  i32.store align=1
                  local.get 6
                  local.get 5
                  i32.const 4
                  i32.add
                  i32.store
                  local.get 7
                  local.get 1
                  i32.const 4
                  i32.add
                  i32.store
                  local.get 1
                  local.get 3
                  i32.const 192
                  i32.add
                  local.get 14
                  i32.const 2
                  i32.add
                  local.tee 14
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  local.tee 5
                  i32.load align=1
                  i32.store align=1
                end
                local.get 4
                i32.const 1
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 5
                local.get 12
                local.get 14
                i32.const 2
                i32.shl
                i32.add
                i32.load
                i32.load align=1
                i32.store align=1
              end
              local.get 10
              i32.const 30
              i32.shl
              local.get 9
              i32.const 2
              i32.shr_u
              i32.or
              local.set 1
              local.get 11
              i32.const 2
              i32.add
              local.set 11
              local.get 10
              i32.const 2
              i32.shr_u
              local.set 10
              br 1 (;@4;)
            end
            block  ;; label = @5
              block  ;; label = @6
                local.get 3
                local.get 11
                i32.const -1
                i32.add
                local.tee 15
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.get 8
                local.get 0
                i32.sub
                i32.lt_u
                br_if 0 (;@6;)
                local.get 0
                local.get 2
                local.get 9
                local.get 10
                local.get 11
                i32.const 0
                local.get 3
                call $qsort_trinkle
                br 1 (;@5;)
              end
              local.get 3
              local.get 0
              i32.store offset=192
              local.get 11
              i32.const 2
              i32.lt_s
              br_if 0 (;@5;)
              i32.const 1
              local.set 4
              local.get 12
              local.set 6
              local.get 0
              local.set 1
              local.get 11
              local.set 5
              block  ;; label = @6
                loop  ;; label = @7
                  block  ;; label = @8
                    local.get 0
                    local.get 1
                    i32.const -4
                    i32.add
                    local.tee 1
                    local.get 3
                    local.get 5
                    i32.const -2
                    i32.add
                    local.tee 13
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.load
                    i32.sub
                    local.tee 7
                    local.get 2
                    call_indirect (type 5)
                    i32.const 0
                    i32.lt_s
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 1
                    local.get 2
                    call_indirect (type 5)
                    i32.const -1
                    i32.gt_s
                    br_if 2 (;@6;)
                  end
                  local.get 6
                  local.get 7
                  local.get 1
                  local.get 7
                  local.get 1
                  local.get 2
                  call_indirect (type 5)
                  i32.const -1
                  i32.gt_s
                  local.tee 14
                  select
                  local.tee 1
                  i32.store
                  local.get 6
                  i32.const 4
                  i32.add
                  local.set 6
                  local.get 4
                  i32.const 1
                  i32.add
                  local.set 4
                  local.get 5
                  i32.const -1
                  i32.add
                  local.get 13
                  local.get 14
                  select
                  local.tee 5
                  i32.const 1
                  i32.gt_u
                  br_if 0 (;@7;)
                end
              end
              local.get 4
              i32.const 2
              i32.lt_u
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load offset=192
              local.tee 5
              i32.load align=1
              i32.store offset=432
              local.get 3
              i32.const 192
              i32.add
              local.get 4
              i32.const 2
              i32.shl
              i32.add
              local.get 3
              i32.const 432
              i32.add
              i32.store
              i32.const 0
              local.set 14
              block  ;; label = @6
                local.get 4
                i32.const -2
                i32.add
                local.tee 20
                i32.const 2
                i32.lt_u
                br_if 0 (;@6;)
                local.get 20
                i32.const 1
                i32.shr_u
                i32.const 1
                i32.add
                i32.const -2
                i32.and
                local.set 16
                i32.const 0
                local.set 14
                local.get 3
                i32.const 192
                i32.add
                local.set 1
                loop  ;; label = @7
                  local.get 5
                  local.get 1
                  i32.const 4
                  i32.add
                  local.tee 17
                  i32.load
                  local.tee 6
                  i32.load align=1
                  i32.store align=1
                  local.get 6
                  local.get 1
                  i32.const 8
                  i32.add
                  local.tee 18
                  i32.load
                  local.tee 7
                  i32.load align=1
                  i32.store align=1
                  local.get 7
                  local.get 1
                  i32.const 12
                  i32.add
                  local.tee 19
                  i32.load
                  local.tee 13
                  i32.load align=1
                  i32.store align=1
                  local.get 1
                  local.get 5
                  i32.const 4
                  i32.add
                  i32.store
                  local.get 18
                  local.get 7
                  i32.const 4
                  i32.add
                  i32.store
                  local.get 17
                  local.get 6
                  i32.const 4
                  i32.add
                  i32.store
                  local.get 19
                  local.get 13
                  i32.const 4
                  i32.add
                  i32.store
                  local.get 13
                  local.get 1
                  i32.const 16
                  i32.add
                  local.tee 1
                  i32.load
                  local.tee 5
                  i32.load align=1
                  i32.store align=1
                  local.get 14
                  i32.const 4
                  i32.add
                  local.set 14
                  local.get 16
                  i32.const -2
                  i32.add
                  local.tee 16
                  br_if 0 (;@7;)
                end
              end
              block  ;; label = @6
                local.get 20
                i32.const 2
                i32.and
                br_if 0 (;@6;)
                local.get 5
                local.get 3
                i32.const 192
                i32.add
                local.get 14
                i32.const 2
                i32.shl
                i32.add
                local.tee 6
                i32.const 4
                i32.add
                local.tee 7
                i32.load
                local.tee 1
                i32.load align=1
                i32.store align=1
                local.get 6
                local.get 5
                i32.const 4
                i32.add
                i32.store
                local.get 7
                local.get 1
                i32.const 4
                i32.add
                i32.store
                local.get 1
                local.get 3
                i32.const 192
                i32.add
                local.get 14
                i32.const 2
                i32.add
                local.tee 14
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.tee 5
                i32.load align=1
                i32.store align=1
              end
              local.get 4
              i32.const 1
              i32.and
              i32.eqz
              br_if 0 (;@5;)
              local.get 5
              local.get 12
              local.get 14
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.load align=1
              i32.store align=1
            end
            block  ;; label = @5
              local.get 11
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 10
              i32.const 1
              i32.shl
              local.get 9
              i32.const 31
              i32.shr_u
              i32.or
              local.set 10
              local.get 9
              i32.const 1
              i32.shl
              local.set 1
              i32.const 0
              local.set 11
              br 1 (;@4;)
            end
            i32.const 0
            local.get 9
            local.get 15
            i32.const 31
            i32.gt_u
            local.tee 1
            select
            local.tee 6
            i32.const 32
            local.get 11
            i32.const -33
            i32.add
            local.get 15
            local.get 1
            select
            local.tee 5
            i32.sub
            i32.shr_u
            local.get 9
            local.get 10
            local.get 1
            select
            local.get 5
            i32.shl
            i32.or
            local.set 10
            local.get 6
            local.get 5
            i32.shl
            local.set 1
            i32.const 1
            local.set 11
          end
          local.get 1
          i32.const 1
          i32.or
          local.set 9
          local.get 0
          i32.const 4
          i32.add
          local.tee 0
          local.get 8
          i32.lt_u
          br_if 0 (;@3;)
        end
      end
      local.get 0
      local.get 2
      local.get 9
      local.get 10
      local.get 11
      i32.const 0
      local.get 3
      call $qsort_trinkle
      block  ;; label = @2
        local.get 11
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 9
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 10
        i32.eqz
        br_if 1 (;@1;)
      end
      local.get 0
      i32.const -4
      i32.add
      local.set 1
      loop  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 11
            i32.const 1
            i32.gt_s
            br_if 0 (;@4;)
            i32.const 0
            local.get 10
            local.get 9
            i32.const -1
            i32.add
            i32.ctz
            local.tee 0
            local.get 10
            i32.ctz
            local.tee 5
            i32.const 32
            i32.add
            i32.const 0
            local.get 5
            select
            local.get 0
            select
            local.tee 0
            i32.const 31
            i32.gt_u
            local.tee 5
            select
            local.tee 7
            i32.const 32
            local.get 0
            i32.const -32
            i32.add
            local.get 0
            local.get 5
            select
            local.tee 6
            i32.sub
            i32.shl
            local.get 10
            local.get 9
            local.get 5
            select
            local.get 6
            i32.shr_u
            i32.or
            local.set 9
            local.get 7
            local.get 6
            i32.shr_u
            local.set 10
            local.get 0
            local.get 11
            i32.add
            local.set 11
            br 1 (;@3;)
          end
          local.get 11
          i32.const -1
          i32.add
          local.set 0
          local.get 1
          local.get 3
          local.get 11
          i32.const -2
          i32.add
          local.tee 11
          i32.const 2
          i32.shl
          i32.add
          i32.load
          i32.sub
          local.get 2
          local.get 9
          i32.const 30
          i32.shr_u
          local.tee 5
          i32.const 31
          i32.shl
          local.get 9
          i32.const 1
          i32.shl
          i32.const 2147483646
          i32.and
          i32.or
          i32.const 3
          i32.xor
          local.tee 6
          local.get 10
          i32.const 2
          i32.shl
          local.get 5
          i32.or
          local.tee 10
          i32.const 1
          i32.shr_u
          local.get 0
          i32.const 1
          local.get 3
          call $qsort_trinkle
          local.get 1
          local.get 2
          local.get 6
          i32.const 1
          i32.shl
          i32.const 1
          i32.or
          local.tee 9
          local.get 10
          local.get 11
          i32.const 1
          local.get 3
          call $qsort_trinkle
        end
        local.get 1
        i32.const -4
        i32.add
        local.set 1
        local.get 11
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 9
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 10
        br_if 0 (;@2;)
      end
    end
    local.get 3
    i32.const 688
    i32.add
    global.set $__stack_pointer)
  (func $floor1_look (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 272
    i32.sub
    local.tee 3
    global.set $__stack_pointer
    i32.const 1
    i32.const 780
    call $calloc
    local.tee 4
    local.get 2
    i32.store offset=776
    local.get 4
    local.get 2
    i32.const 840
    i32.add
    i32.load
    i32.store offset=768
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                i32.load
                local.tee 5
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                local.get 5
                i32.const 3
                i32.and
                local.set 6
                local.get 5
                i32.const 4
                i32.ge_u
                br_if 1 (;@5;)
                i32.const 0
                local.set 7
                i32.const 0
                local.set 8
                br 2 (;@4;)
              end
              i32.const 2
              local.set 9
              local.get 4
              i32.const 2
              i32.store offset=764
              i32.const 0
              local.set 7
              i32.const 0
              local.set 8
              i32.const 2
              local.set 6
              br 2 (;@3;)
            end
            local.get 2
            i32.const 16
            i32.add
            local.set 10
            i32.const 0
            local.set 8
            local.get 2
            i32.const 128
            i32.add
            local.set 11
            local.get 5
            i32.const 2147483644
            i32.and
            local.tee 7
            local.set 5
            loop  ;; label = @5
              local.get 11
              local.get 10
              i32.load
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.get 11
              local.get 10
              i32.const -4
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.get 11
              local.get 10
              i32.const -8
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.get 11
              local.get 10
              i32.const -12
              i32.add
              i32.load
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.get 8
              i32.add
              i32.add
              i32.add
              i32.add
              local.set 8
              local.get 10
              i32.const 16
              i32.add
              local.set 10
              local.get 5
              i32.const -4
              i32.add
              local.tee 5
              br_if 0 (;@5;)
            end
          end
          block  ;; label = @4
            local.get 6
            i32.eqz
            br_if 0 (;@4;)
            local.get 7
            i32.const 2
            i32.shl
            local.get 2
            i32.add
            i32.const 4
            i32.add
            local.set 10
            loop  ;; label = @5
              local.get 2
              local.get 10
              i32.load
              i32.const 2
              i32.shl
              i32.add
              i32.const 128
              i32.add
              i32.load
              local.get 8
              i32.add
              local.set 8
              local.get 10
              i32.const 4
              i32.add
              local.set 10
              local.get 6
              i32.const -1
              i32.add
              local.tee 6
              br_if 0 (;@5;)
            end
          end
          local.get 4
          local.get 8
          i32.const 2
          i32.add
          local.tee 9
          i32.store offset=764
          i32.const 0
          local.set 7
          block  ;; label = @4
            local.get 9
            i32.const 0
            i32.gt_s
            br_if 0 (;@4;)
            local.get 3
            local.get 9
            i32.const 4
            call $qsort
            br 3 (;@1;)
          end
          local.get 9
          i32.const 3
          i32.and
          local.set 6
          block  ;; label = @4
            local.get 9
            i32.const 4
            i32.lt_u
            br_if 0 (;@4;)
            local.get 9
            i32.const 2147483644
            i32.and
            local.set 12
            i32.const 0
            local.set 10
            i32.const 0
            local.set 7
            loop  ;; label = @5
              local.get 3
              local.get 10
              i32.add
              local.tee 11
              i32.const 12
              i32.add
              local.get 2
              local.get 10
              i32.add
              local.tee 5
              i32.const 848
              i32.add
              i32.store
              local.get 11
              i32.const 8
              i32.add
              local.get 5
              i32.const 844
              i32.add
              i32.store
              local.get 11
              i32.const 4
              i32.add
              local.get 5
              i32.const 840
              i32.add
              i32.store
              local.get 11
              local.get 5
              i32.const 836
              i32.add
              i32.store
              local.get 10
              i32.const 16
              i32.add
              local.set 10
              local.get 12
              local.get 7
              i32.const 4
              i32.add
              local.tee 7
              i32.ne
              br_if 0 (;@5;)
            end
          end
          local.get 6
          i32.eqz
          br_if 1 (;@2;)
        end
        local.get 7
        i32.const 2
        i32.shl
        local.tee 11
        local.get 2
        i32.add
        i32.const 836
        i32.add
        local.set 10
        local.get 3
        local.get 11
        i32.add
        local.set 11
        loop  ;; label = @3
          local.get 11
          local.get 10
          i32.store
          local.get 10
          i32.const 4
          i32.add
          local.set 10
          local.get 11
          i32.const 4
          i32.add
          local.set 11
          local.get 6
          i32.const -1
          i32.add
          local.tee 6
          br_if 0 (;@3;)
        end
      end
      local.get 2
      i32.const 836
      i32.add
      local.set 10
      local.get 3
      local.get 9
      i32.const 4
      call $qsort
      local.get 9
      i32.const 3
      i32.and
      local.set 7
      i32.const 0
      local.set 12
      block  ;; label = @2
        local.get 9
        i32.const 4
        i32.lt_u
        br_if 0 (;@2;)
        local.get 9
        i32.const 2147483644
        i32.and
        local.set 9
        i32.const 0
        local.set 11
        i32.const 0
        local.set 12
        loop  ;; label = @3
          local.get 4
          local.get 11
          i32.add
          local.tee 6
          local.get 3
          local.get 11
          i32.add
          local.tee 5
          i32.load
          local.get 10
          i32.sub
          i32.const 2
          i32.shr_s
          i32.store
          local.get 6
          i32.const 4
          i32.add
          local.get 5
          i32.const 4
          i32.add
          i32.load
          local.get 10
          i32.sub
          i32.const 2
          i32.shr_s
          i32.store
          local.get 6
          i32.const 8
          i32.add
          local.get 5
          i32.const 8
          i32.add
          i32.load
          local.get 10
          i32.sub
          i32.const 2
          i32.shr_s
          i32.store
          local.get 6
          i32.const 12
          i32.add
          local.get 5
          i32.const 12
          i32.add
          i32.load
          local.get 10
          i32.sub
          i32.const 2
          i32.shr_s
          i32.store
          local.get 11
          i32.const 16
          i32.add
          local.set 11
          local.get 9
          local.get 12
          i32.const 4
          i32.add
          local.tee 12
          i32.ne
          br_if 0 (;@3;)
        end
      end
      local.get 7
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 12
      i32.const 2
      i32.shl
      local.tee 6
      i32.add
      local.set 11
      local.get 3
      local.get 6
      i32.add
      local.set 6
      loop  ;; label = @2
        local.get 11
        local.get 6
        i32.load
        local.get 10
        i32.sub
        i32.const 2
        i32.shr_s
        i32.store
        local.get 6
        i32.const 4
        i32.add
        local.set 6
        local.get 11
        i32.const 4
        i32.add
        local.set 11
        local.get 7
        i32.const -1
        i32.add
        local.tee 7
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 2
      i32.load offset=832
      i32.const -1
      i32.add
      local.tee 10
      i32.const 3
      i32.gt_u
      br_if 0 (;@1;)
      local.get 4
      local.get 10
      i32.const 2
      i32.shl
      i32.const 16788496
      i32.add
      i32.load
      i32.store offset=772
    end
    block  ;; label = @1
      local.get 8
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 2
      i32.const 840
      i32.add
      local.set 13
      i32.const 0
      local.set 14
      i32.const 2
      local.set 15
      loop  ;; label = @2
        i32.const 1
        local.set 16
        i32.const 0
        local.set 17
        block  ;; label = @3
          local.get 14
          i32.const 2
          i32.add
          local.tee 10
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          local.get 15
          i32.const -2
          i32.and
          local.set 18
          local.get 2
          local.get 10
          i32.const 2
          i32.shl
          i32.add
          i32.const 836
          i32.add
          i32.load
          local.set 5
          local.get 4
          i32.load offset=768
          local.set 12
          i32.const 1
          local.set 16
          i32.const 0
          local.set 6
          local.get 13
          local.set 7
          i32.const 0
          local.set 9
          i32.const 0
          local.set 17
          loop  ;; label = @4
            local.get 7
            i32.load
            local.tee 10
            local.get 7
            i32.const -4
            i32.add
            i32.load
            local.tee 11
            local.get 12
            local.get 11
            local.get 12
            i32.lt_s
            local.get 11
            local.get 5
            i32.gt_s
            i32.and
            local.tee 19
            select
            local.tee 12
            local.get 10
            local.get 12
            i32.lt_s
            local.get 10
            local.get 5
            i32.gt_s
            i32.and
            local.tee 20
            select
            local.set 12
            local.get 6
            i32.const 1
            i32.add
            local.tee 21
            local.get 6
            local.get 16
            local.get 19
            select
            local.get 20
            select
            local.set 16
            local.get 10
            local.get 11
            local.get 9
            local.get 11
            local.get 9
            i32.gt_s
            local.get 11
            local.get 5
            i32.lt_s
            i32.and
            local.tee 19
            select
            local.tee 11
            local.get 10
            local.get 11
            i32.gt_s
            local.get 10
            local.get 5
            i32.lt_s
            i32.and
            local.tee 11
            select
            local.set 9
            local.get 21
            local.get 6
            local.get 17
            local.get 19
            select
            local.get 11
            select
            local.set 17
            local.get 7
            i32.const 8
            i32.add
            local.set 7
            local.get 6
            i32.const 2
            i32.add
            local.tee 6
            local.get 18
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 15
          i32.const 1
          i32.and
          i32.eqz
          br_if 0 (;@3;)
          local.get 18
          local.get 16
          local.get 2
          local.get 18
          i32.const 2
          i32.shl
          i32.add
          i32.const 836
          i32.add
          i32.load
          local.tee 10
          local.get 5
          i32.gt_s
          select
          local.get 16
          local.get 10
          local.get 12
          i32.lt_s
          select
          local.set 16
          local.get 18
          local.get 17
          local.get 10
          local.get 5
          i32.lt_s
          select
          local.get 17
          local.get 10
          local.get 9
          i32.gt_s
          select
          local.set 17
        end
        local.get 4
        local.get 14
        i32.const 2
        i32.shl
        i32.add
        local.tee 10
        i32.const 260
        i32.add
        local.get 16
        i32.store
        local.get 10
        i32.const 512
        i32.add
        local.get 17
        i32.store
        local.get 15
        i32.const 1
        i32.add
        local.set 15
        local.get 14
        i32.const 1
        i32.add
        local.tee 14
        local.get 8
        i32.ne
        br_if 0 (;@2;)
      end
    end
    local.get 3
    i32.const 272
    i32.add
    global.set $__stack_pointer
    local.get 4)
  (func $floor1_free_info (type 4) (param i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      call $free
    end)
  (func $floor1_free_look (type 4) (param i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      call $free
    end)
  (func $floor1_inverse1 (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 1
    i32.load offset=776
    local.set 2
    local.get 0
    i32.load offset=64
    i32.load offset=4
    i32.load offset=28
    i32.load offset=3104
    local.set 3
    i32.const 0
    local.set 4
    block  ;; label = @1
      local.get 0
      i32.const 4
      i32.add
      local.tee 5
      i32.const 1
      call $oggpack_read
      i32.const 1
      i32.ne
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=68
      local.set 6
      block  ;; label = @2
        local.get 0
        i32.load offset=72
        local.tee 7
        local.get 1
        i32.load offset=764
        i32.const 2
        i32.shl
        i32.const 7
        i32.add
        i32.const -8
        i32.and
        local.tee 4
        i32.add
        local.get 0
        i32.load offset=76
        i32.le_s
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 6
          i32.eqz
          br_if 0 (;@3;)
          i32.const 8
          call $malloc
          local.tee 8
          local.get 6
          i32.store
          local.get 0
          i32.load offset=84
          local.set 9
          local.get 0
          local.get 8
          i32.store offset=84
          local.get 8
          local.get 9
          i32.store offset=4
          local.get 0
          local.get 0
          i32.load offset=80
          local.get 7
          i32.add
          i32.store offset=80
        end
        local.get 0
        local.get 4
        i32.store offset=76
        local.get 0
        local.get 4
        call $malloc
        local.tee 6
        i32.store offset=68
        i32.const 0
        local.set 7
      end
      local.get 0
      local.get 7
      local.get 4
      i32.add
      i32.store offset=72
      local.get 6
      local.get 7
      i32.add
      local.set 10
      i32.const 0
      local.set 4
      i32.const 0
      local.set 8
      block  ;; label = @2
        local.get 1
        i32.load offset=772
        i32.const -1
        i32.add
        local.tee 0
        i32.eqz
        br_if 0 (;@2;)
        i32.const 0
        local.set 8
        loop  ;; label = @3
          local.get 8
          i32.const 1
          i32.add
          local.set 8
          local.get 0
          i32.const 1
          i32.gt_u
          local.set 9
          local.get 0
          i32.const 1
          i32.shr_u
          local.set 0
          local.get 9
          br_if 0 (;@3;)
        end
      end
      local.get 10
      local.get 5
      local.get 8
      call $oggpack_read
      i32.store
      block  ;; label = @2
        local.get 1
        i32.load offset=772
        i32.const -1
        i32.add
        local.tee 0
        i32.eqz
        br_if 0 (;@2;)
        i32.const 0
        local.set 4
        loop  ;; label = @3
          local.get 4
          i32.const 1
          i32.add
          local.set 4
          local.get 0
          i32.const 1
          i32.gt_u
          local.set 8
          local.get 0
          i32.const 1
          i32.shr_u
          local.set 0
          local.get 8
          br_if 0 (;@3;)
        end
      end
      local.get 10
      i32.const 4
      i32.add
      local.get 5
      local.get 4
      call $oggpack_read
      i32.store
      block  ;; label = @2
        local.get 2
        i32.load
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 11
        i32.const 2
        local.set 12
        loop  ;; label = @3
          local.get 2
          local.get 2
          local.get 11
          i32.const 2
          i32.shl
          i32.add
          i32.const 4
          i32.add
          i32.load
          local.tee 9
          i32.const 2
          i32.shl
          i32.add
          local.tee 4
          i32.const 128
          i32.add
          i32.load
          local.set 13
          i32.const 0
          local.set 0
          block  ;; label = @4
            local.get 4
            i32.const 192
            i32.add
            i32.load
            local.tee 14
            i32.eqz
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 3
              local.get 4
              i32.const 256
              i32.add
              i32.load
              i32.const 52
              i32.mul
              i32.add
              local.tee 0
              i32.const 8
              i32.add
              i32.load
              i32.const 1
              i32.ge_s
              br_if 0 (;@5;)
              i32.const 0
              return
            end
            i32.const 0
            local.set 4
            local.get 0
            local.get 5
            call $decode_packed_entry_number
            local.tee 8
            i32.const 0
            i32.lt_s
            br_if 3 (;@1;)
            local.get 0
            i32.const 24
            i32.add
            i32.load
            local.get 8
            i32.const 2
            i32.shl
            i32.add
            i32.load
            local.tee 0
            i32.const -1
            i32.eq
            br_if 3 (;@1;)
          end
          block  ;; label = @4
            local.get 13
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            i32.const -1
            local.get 14
            i32.shl
            i32.const -1
            i32.xor
            local.set 15
            i32.const 0
            local.set 8
            local.get 2
            local.get 9
            i32.const 5
            i32.shl
            i32.add
            local.set 16
            local.get 10
            local.get 12
            i32.const 2
            i32.shl
            i32.add
            local.tee 17
            local.set 4
            loop  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  local.get 16
                  local.get 0
                  local.get 15
                  i32.and
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.const 320
                  i32.add
                  i32.load
                  local.tee 9
                  i32.const 0
                  i32.lt_s
                  br_if 0 (;@7;)
                  block  ;; label = @8
                    block  ;; label = @9
                      local.get 3
                      local.get 9
                      i32.const 52
                      i32.mul
                      i32.add
                      local.tee 9
                      i32.const 8
                      i32.add
                      i32.load
                      i32.const 1
                      i32.lt_s
                      br_if 0 (;@9;)
                      local.get 9
                      local.get 5
                      call $decode_packed_entry_number
                      local.tee 18
                      i32.const -1
                      i32.gt_s
                      br_if 1 (;@8;)
                    end
                    local.get 17
                    local.get 8
                    i32.const 2
                    i32.shl
                    i32.add
                    i32.const -1
                    i32.store
                    i32.const 0
                    return
                  end
                  local.get 4
                  local.get 9
                  i32.const 24
                  i32.add
                  i32.load
                  local.get 18
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  local.tee 9
                  i32.store
                  local.get 9
                  i32.const -1
                  i32.ne
                  br_if 1 (;@6;)
                  i32.const 0
                  return
                end
                local.get 4
                i32.const 0
                i32.store
              end
              local.get 0
              local.get 14
              i32.shr_s
              local.set 0
              local.get 4
              i32.const 4
              i32.add
              local.set 4
              local.get 13
              local.get 8
              i32.const 1
              i32.add
              local.tee 8
              i32.ne
              br_if 0 (;@5;)
            end
          end
          local.get 13
          local.get 12
          i32.add
          local.set 12
          local.get 11
          i32.const 1
          i32.add
          local.tee 11
          local.get 2
          i32.load
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=764
        i32.const 3
        i32.lt_s
        br_if 0 (;@2;)
        local.get 1
        i32.const 260
        i32.add
        local.set 0
        local.get 2
        i32.const 844
        i32.add
        local.set 9
        local.get 6
        local.get 7
        i32.add
        i32.const 8
        i32.add
        local.set 8
        local.get 2
        i32.const 836
        i32.add
        local.set 18
        i32.const 2
        local.set 14
        loop  ;; label = @3
          i32.const 0
          local.get 10
          local.get 0
          i32.load
          i32.const 2
          i32.shl
          local.tee 13
          i32.add
          i32.load
          i32.const 32767
          i32.and
          local.get 10
          local.get 0
          i32.const 252
          i32.add
          local.tee 3
          i32.load
          i32.const 2
          i32.shl
          local.tee 5
          i32.add
          i32.load
          i32.const 32767
          i32.and
          local.tee 15
          i32.sub
          local.tee 4
          local.get 4
          i32.const 31
          i32.shr_s
          local.tee 16
          i32.xor
          local.get 16
          i32.sub
          local.get 9
          i32.load
          local.get 18
          local.get 5
          i32.add
          i32.load
          local.tee 5
          i32.sub
          i32.mul
          local.get 18
          local.get 13
          i32.add
          i32.load
          local.get 5
          i32.sub
          i32.div_s
          local.tee 13
          i32.sub
          local.get 13
          local.get 4
          i32.const 0
          i32.lt_s
          select
          local.get 15
          i32.add
          local.set 4
          block  ;; label = @4
            block  ;; label = @5
              local.get 8
              i32.load
              local.tee 13
              i32.eqz
              br_if 0 (;@5;)
              block  ;; label = @6
                block  ;; label = @7
                  local.get 13
                  local.get 1
                  i32.load offset=772
                  local.get 4
                  i32.sub
                  local.tee 5
                  local.get 4
                  local.get 5
                  local.get 4
                  i32.lt_s
                  select
                  i32.const 1
                  i32.shl
                  i32.lt_s
                  br_if 0 (;@7;)
                  block  ;; label = @8
                    local.get 5
                    local.get 4
                    i32.le_s
                    br_if 0 (;@8;)
                    local.get 13
                    local.get 4
                    i32.sub
                    local.set 13
                    br 2 (;@6;)
                  end
                  local.get 5
                  local.get 13
                  i32.const -1
                  i32.xor
                  i32.add
                  local.set 13
                  br 1 (;@6;)
                end
                block  ;; label = @7
                  local.get 13
                  i32.const 1
                  i32.and
                  i32.eqz
                  br_if 0 (;@7;)
                  i32.const 0
                  local.get 13
                  i32.const 1
                  i32.add
                  i32.const 1
                  i32.shr_s
                  i32.sub
                  local.set 13
                  br 1 (;@6;)
                end
                local.get 13
                i32.const 1
                i32.shr_s
                local.set 13
              end
              local.get 8
              local.get 13
              local.get 4
              i32.add
              i32.const 32767
              i32.and
              i32.store
              local.get 10
              local.get 3
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.tee 4
              local.get 4
              i32.load
              i32.const 32767
              i32.and
              i32.store
              local.get 10
              local.get 0
              i32.load
              i32.const 2
              i32.shl
              i32.add
              local.tee 4
              local.get 4
              i32.load
              i32.const 32767
              i32.and
              i32.store
              br 1 (;@4;)
            end
            local.get 8
            local.get 4
            i32.const 32768
            i32.or
            i32.store
          end
          local.get 0
          i32.const 4
          i32.add
          local.set 0
          local.get 9
          i32.const 4
          i32.add
          local.set 9
          local.get 8
          i32.const 4
          i32.add
          local.set 8
          local.get 14
          i32.const 1
          i32.add
          local.tee 14
          local.get 1
          i32.load offset=764
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 10
      local.set 4
    end
    local.get 4)
  (func $decode_packed_entry_number (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.load offset=40
    local.set 2
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          local.get 0
          i32.load offset=36
          local.tee 3
          i32.const 32
          i32.gt_u
          br_if 0 (;@3;)
          local.get 1
          i32.load offset=4
          local.tee 4
          local.get 3
          i32.add
          local.set 5
          local.get 3
          i32.const 2
          i32.shl
          i32.const 16798208
          i32.add
          i32.load
          local.set 6
          block  ;; label = @4
            block  ;; label = @5
              local.get 1
              i32.load
              local.tee 3
              local.get 1
              i32.load offset=16
              local.tee 7
              i32.const -4
              i32.add
              i32.lt_s
              br_if 0 (;@5;)
              local.get 3
              local.get 7
              local.get 5
              i32.const 7
              i32.add
              i32.const 3
              i32.shr_s
              i32.sub
              i32.gt_s
              br_if 2 (;@3;)
              local.get 5
              br_if 0 (;@5;)
              i32.const 0
              local.set 3
              br 1 (;@4;)
            end
            local.get 1
            i32.load offset=12
            local.tee 7
            i32.load8_u
            local.get 4
            i32.shr_u
            local.set 3
            block  ;; label = @5
              local.get 5
              i32.const 9
              i32.lt_s
              br_if 0 (;@5;)
              local.get 7
              i32.const 1
              i32.add
              i32.load8_u
              i32.const 8
              local.get 4
              i32.sub
              i32.shl
              local.get 3
              i32.or
              local.set 3
              local.get 5
              i32.const 17
              i32.lt_u
              br_if 0 (;@5;)
              local.get 7
              i32.const 2
              i32.add
              i32.load8_u
              i32.const 16
              local.get 4
              i32.sub
              i32.shl
              local.get 3
              i32.or
              local.set 3
              local.get 5
              i32.const 25
              i32.lt_u
              br_if 0 (;@5;)
              local.get 7
              i32.const 3
              i32.add
              i32.load8_u
              i32.const 24
              local.get 4
              i32.sub
              i32.shl
              local.get 3
              i32.or
              local.set 3
              local.get 4
              i32.eqz
              br_if 0 (;@5;)
              local.get 5
              i32.const 33
              i32.lt_u
              br_if 0 (;@5;)
              local.get 7
              i32.const 4
              i32.add
              i32.load8_u
              i32.const 32
              local.get 4
              i32.sub
              i32.shl
              local.get 3
              i32.or
              local.set 3
            end
            local.get 3
            local.get 6
            i32.and
            local.tee 3
            i32.const 0
            i32.lt_s
            br_if 1 (;@3;)
          end
          block  ;; label = @4
            local.get 0
            i32.load offset=32
            local.get 3
            i32.const 2
            i32.shl
            i32.add
            i32.load
            local.tee 3
            i32.const -1
            i32.gt_s
            br_if 0 (;@4;)
            local.get 0
            i32.load offset=8
            local.get 3
            i32.const 32767
            i32.and
            i32.sub
            local.set 8
            local.get 3
            i32.const 15
            i32.shr_u
            i32.const 32767
            i32.and
            local.set 6
            br 2 (;@2;)
          end
          local.get 0
          i32.load offset=28
          local.get 3
          i32.const -1
          i32.add
          local.tee 5
          i32.add
          i32.load8_s
          local.set 4
          br 2 (;@1;)
        end
        local.get 0
        i32.load offset=8
        local.set 8
        i32.const 0
        local.set 6
      end
      i32.const -1
      local.set 5
      block  ;; label = @2
        block  ;; label = @3
          local.get 2
          i32.const 32
          i32.gt_u
          br_if 0 (;@3;)
          local.get 1
          i32.load offset=4
          local.tee 4
          local.get 2
          i32.add
          local.set 3
          local.get 2
          i32.const 2
          i32.shl
          i32.const 16798208
          i32.add
          i32.load
          local.set 7
          block  ;; label = @4
            local.get 1
            i32.load
            local.tee 9
            local.get 1
            i32.load offset=16
            local.tee 10
            i32.const -4
            i32.add
            i32.lt_s
            br_if 0 (;@4;)
            i32.const -1
            local.set 5
            local.get 9
            local.get 10
            local.get 3
            i32.const 7
            i32.add
            i32.const 3
            i32.shr_s
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
            local.get 3
            br_if 0 (;@4;)
            i32.const 0
            local.set 5
            br 2 (;@2;)
          end
          local.get 1
          i32.load offset=12
          local.tee 9
          i32.load8_u
          local.get 4
          i32.shr_u
          local.set 5
          block  ;; label = @4
            local.get 3
            i32.const 9
            i32.lt_s
            br_if 0 (;@4;)
            local.get 9
            i32.const 1
            i32.add
            i32.load8_u
            i32.const 8
            local.get 4
            i32.sub
            i32.shl
            local.get 5
            i32.or
            local.set 5
            local.get 3
            i32.const 17
            i32.lt_u
            br_if 0 (;@4;)
            local.get 9
            i32.const 2
            i32.add
            i32.load8_u
            i32.const 16
            local.get 4
            i32.sub
            i32.shl
            local.get 5
            i32.or
            local.set 5
            local.get 3
            i32.const 25
            i32.lt_u
            br_if 0 (;@4;)
            local.get 9
            i32.const 3
            i32.add
            i32.load8_u
            i32.const 24
            local.get 4
            i32.sub
            i32.shl
            local.get 5
            i32.or
            local.set 5
            local.get 4
            i32.eqz
            br_if 0 (;@4;)
            local.get 3
            i32.const 33
            i32.lt_u
            br_if 0 (;@4;)
            local.get 9
            i32.const 4
            i32.add
            i32.load8_u
            i32.const 32
            local.get 4
            i32.sub
            i32.shl
            local.get 5
            i32.or
            local.set 5
          end
          local.get 5
          local.get 7
          i32.and
          local.set 5
        end
        local.get 5
        i32.const 31
        i32.shr_u
        local.set 3
        block  ;; label = @3
          local.get 5
          i32.const -1
          i32.gt_s
          br_if 0 (;@3;)
          local.get 2
          i32.const 2
          i32.lt_s
          br_if 0 (;@3;)
          local.get 2
          i32.const -1
          i32.add
          local.set 3
          local.get 2
          i32.const 2
          i32.shl
          i32.const 16798204
          i32.add
          local.set 4
          loop  ;; label = @4
            i32.const -1
            local.set 5
            block  ;; label = @5
              local.get 3
              i32.const 32
              i32.gt_u
              br_if 0 (;@5;)
              local.get 3
              local.get 1
              i32.load offset=4
              local.tee 2
              i32.add
              local.set 7
              local.get 4
              i32.load
              local.set 9
              block  ;; label = @6
                local.get 1
                i32.load
                local.tee 10
                local.get 1
                i32.load offset=16
                local.tee 11
                i32.const -4
                i32.add
                i32.lt_s
                br_if 0 (;@6;)
                i32.const -1
                local.set 5
                local.get 10
                local.get 11
                local.get 7
                i32.const 7
                i32.add
                i32.const 3
                i32.shr_s
                i32.sub
                i32.gt_s
                br_if 1 (;@5;)
                local.get 7
                br_if 0 (;@6;)
                i32.const 0
                local.set 5
                local.get 3
                local.set 2
                br 4 (;@2;)
              end
              local.get 1
              i32.load offset=12
              local.tee 10
              i32.load8_u
              local.get 2
              i32.shr_u
              local.set 5
              block  ;; label = @6
                local.get 7
                i32.const 9
                i32.lt_s
                br_if 0 (;@6;)
                local.get 10
                i32.const 1
                i32.add
                i32.load8_u
                i32.const 8
                local.get 2
                i32.sub
                i32.shl
                local.get 5
                i32.or
                local.set 5
                local.get 7
                i32.const 17
                i32.lt_u
                br_if 0 (;@6;)
                local.get 10
                i32.const 2
                i32.add
                i32.load8_u
                i32.const 16
                local.get 2
                i32.sub
                i32.shl
                local.get 5
                i32.or
                local.set 5
                local.get 7
                i32.const 25
                i32.lt_u
                br_if 0 (;@6;)
                local.get 10
                i32.const 3
                i32.add
                i32.load8_u
                i32.const 24
                local.get 2
                i32.sub
                i32.shl
                local.get 5
                i32.or
                local.set 5
                local.get 2
                i32.eqz
                br_if 0 (;@6;)
                local.get 7
                i32.const 33
                i32.lt_u
                br_if 0 (;@6;)
                local.get 10
                i32.const 4
                i32.add
                i32.load8_u
                i32.const 32
                local.get 2
                i32.sub
                i32.shl
                local.get 5
                i32.or
                local.set 5
              end
              local.get 5
              local.get 9
              i32.and
              local.set 5
            end
            local.get 3
            i32.const -1
            i32.add
            local.set 7
            block  ;; label = @5
              local.get 5
              i32.const -1
              i32.gt_s
              br_if 0 (;@5;)
              local.get 3
              i32.const 1
              i32.add
              local.set 2
              local.get 4
              i32.const -4
              i32.add
              local.set 4
              local.get 7
              local.set 3
              local.get 2
              i32.const 2
              i32.gt_u
              br_if 1 (;@4;)
            end
          end
          local.get 5
          i32.const 31
          i32.shr_u
          local.set 3
          local.get 7
          i32.const 1
          i32.add
          local.set 2
        end
        local.get 3
        i32.eqz
        br_if 0 (;@2;)
        i32.const -1
        local.set 5
        i32.const 1
        local.set 4
        br 1 (;@1;)
      end
      block  ;; label = @2
        local.get 8
        local.get 6
        i32.sub
        local.tee 3
        i32.const 2
        i32.lt_s
        br_if 0 (;@2;)
        local.get 5
        i32.const 24
        i32.shl
        local.get 5
        i32.const 65280
        i32.and
        i32.const 8
        i32.shl
        i32.or
        local.get 5
        i32.const 8
        i32.shr_u
        i32.const 65280
        i32.and
        local.get 5
        i32.const 24
        i32.shr_u
        i32.or
        i32.or
        local.tee 5
        i32.const 4
        i32.shr_u
        i32.const 252645135
        i32.and
        local.get 5
        i32.const 252645135
        i32.and
        i32.const 4
        i32.shl
        i32.or
        local.tee 5
        i32.const 2
        i32.shr_u
        i32.const 858993459
        i32.and
        local.get 5
        i32.const 858993459
        i32.and
        i32.const 2
        i32.shl
        i32.or
        local.tee 5
        i32.const 1
        i32.shr_u
        i32.const 1431655765
        i32.and
        local.get 5
        i32.const 1431655765
        i32.and
        i32.const 1
        i32.shl
        i32.or
        local.set 4
        local.get 0
        i32.load offset=20
        local.set 7
        loop  ;; label = @3
          local.get 8
          local.get 3
          i32.const 1
          i32.shr_u
          local.tee 3
          i32.const 0
          local.get 7
          local.get 6
          i32.const 2
          i32.shl
          i32.add
          local.get 3
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.get 4
          i32.gt_u
          local.tee 5
          select
          i32.sub
          local.tee 8
          i32.const 0
          local.get 3
          local.get 5
          select
          local.get 6
          i32.add
          local.tee 6
          i32.sub
          local.tee 3
          i32.const 1
          i32.gt_s
          br_if 0 (;@3;)
        end
      end
      local.get 2
      i32.const 1
      i32.add
      local.get 0
      i32.load offset=28
      local.get 6
      i32.add
      i32.load8_s
      local.tee 3
      local.get 2
      local.get 3
      i32.lt_s
      local.tee 3
      select
      local.set 4
      i32.const -1
      local.get 6
      local.get 3
      select
      local.set 5
    end
    block  ;; label = @1
      block  ;; label = @2
        local.get 1
        i32.load
        local.tee 6
        local.get 1
        i32.load offset=16
        local.tee 3
        local.get 1
        i32.load offset=4
        local.get 4
        i32.add
        local.tee 4
        i32.const 7
        i32.add
        i32.const 3
        i32.shr_s
        i32.sub
        i32.gt_s
        br_if 0 (;@2;)
        local.get 1
        local.get 1
        i32.load offset=12
        local.get 4
        i32.const 8
        i32.div_s
        local.tee 3
        i32.add
        i32.store offset=12
        local.get 4
        i32.const 7
        i32.and
        local.set 4
        local.get 3
        local.get 6
        i32.add
        local.set 3
        br 1 (;@1;)
      end
      local.get 1
      i32.const 0
      i32.store offset=12
      i32.const 1
      local.set 4
    end
    local.get 1
    local.get 4
    i32.store offset=4
    local.get 1
    local.get 3
    i32.store
    local.get 5)
  (func $floor1_inverse2 (type 2) (param i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.load offset=64
    i32.load offset=4
    i32.load offset=28
    local.get 0
    i32.load offset=28
    i32.const 2
    i32.shl
    i32.add
    i32.load
    i32.const 2
    i32.div_s
    local.set 4
    block  ;; label = @1
      block  ;; label = @2
        local.get 2
        i32.eqz
        br_if 0 (;@2;)
        i32.const 0
        local.set 5
        local.get 1
        i32.load offset=776
        local.tee 6
        i32.load offset=832
        local.get 2
        i32.load
        i32.mul
        local.tee 0
        i32.const 255
        local.get 0
        i32.const 255
        i32.lt_s
        select
        local.tee 0
        i32.const 0
        local.get 0
        i32.const 0
        i32.gt_s
        select
        local.set 7
        block  ;; label = @3
          local.get 1
          i32.load offset=764
          i32.const 2
          i32.lt_s
          br_if 0 (;@3;)
          local.get 3
          i32.const 4
          i32.add
          local.set 8
          i32.const 0
          local.set 9
          i32.const 0
          local.set 5
          i32.const 1
          local.set 10
          loop  ;; label = @4
            block  ;; label = @5
              local.get 2
              local.get 1
              local.get 10
              i32.const 2
              i32.shl
              i32.add
              i32.load
              i32.const 2
              i32.shl
              local.tee 0
              i32.add
              i32.load
              local.tee 11
              i32.const 32767
              i32.gt_u
              br_if 0 (;@5;)
              local.get 6
              i32.load offset=832
              local.get 11
              i32.mul
              local.tee 11
              i32.const 255
              local.get 11
              i32.const 255
              i32.lt_s
              select
              local.tee 11
              i32.const 0
              local.get 11
              i32.const 0
              i32.gt_s
              select
              local.tee 12
              local.get 7
              i32.sub
              local.tee 13
              local.get 6
              local.get 0
              i32.add
              i32.const 836
              i32.add
              i32.load
              local.tee 5
              local.get 9
              i32.sub
              local.tee 11
              i32.div_s
              local.set 14
              block  ;; label = @6
                local.get 4
                local.get 5
                local.get 4
                local.get 5
                i32.lt_s
                select
                local.tee 15
                local.get 9
                i32.le_s
                br_if 0 (;@6;)
                local.get 3
                local.get 9
                i32.const 2
                i32.shl
                i32.add
                local.tee 0
                local.get 0
                i32.load
                i32.const 6
                i32.shr_s
                local.get 7
                i32.const 2
                i32.shl
                i32.const 16787472
                i32.add
                i32.load
                i32.mul
                i32.store
              end
              block  ;; label = @6
                local.get 9
                i32.const 1
                i32.add
                local.get 15
                i32.ge_s
                br_if 0 (;@6;)
                local.get 13
                local.get 13
                i32.const 31
                i32.shr_s
                local.tee 0
                i32.xor
                local.get 0
                i32.sub
                local.get 14
                local.get 11
                i32.mul
                local.tee 0
                i32.const 31
                i32.shr_s
                local.tee 16
                local.get 0
                local.get 16
                i32.xor
                i32.sub
                i32.add
                local.set 16
                i32.const 1
                i32.const -1
                local.get 13
                i32.const -1
                i32.gt_s
                select
                local.set 17
                local.get 8
                local.get 9
                i32.const 2
                i32.shl
                i32.add
                local.set 0
                local.get 9
                i32.const -1
                i32.xor
                local.get 15
                i32.add
                local.set 9
                i32.const 0
                local.set 13
                loop  ;; label = @7
                  local.get 0
                  local.get 0
                  i32.load
                  i32.const 6
                  i32.shr_s
                  local.get 7
                  local.get 14
                  i32.add
                  i32.const 0
                  local.get 17
                  local.get 13
                  local.get 16
                  i32.add
                  local.tee 13
                  local.get 11
                  i32.lt_s
                  local.tee 15
                  select
                  i32.add
                  local.tee 7
                  i32.const 2
                  i32.shl
                  i32.const 16787472
                  i32.add
                  i32.load
                  i32.mul
                  i32.store
                  local.get 13
                  i32.const 0
                  local.get 11
                  local.get 15
                  select
                  i32.sub
                  local.set 13
                  local.get 0
                  i32.const 4
                  i32.add
                  local.set 0
                  local.get 9
                  i32.const -1
                  i32.add
                  local.tee 9
                  br_if 0 (;@7;)
                end
              end
              local.get 5
              local.set 9
              local.get 12
              local.set 7
            end
            local.get 10
            i32.const 1
            i32.add
            local.tee 10
            local.get 1
            i32.load offset=764
            i32.lt_s
            br_if 0 (;@4;)
          end
        end
        i32.const 1
        local.set 13
        local.get 5
        local.get 4
        i32.ge_s
        br_if 1 (;@1;)
        local.get 5
        local.set 9
        block  ;; label = @3
          local.get 4
          local.get 5
          i32.sub
          i32.const 3
          i32.and
          local.tee 11
          i32.eqz
          br_if 0 (;@3;)
          local.get 5
          local.get 11
          i32.add
          local.set 9
          local.get 3
          local.get 5
          i32.const 2
          i32.shl
          i32.add
          local.set 0
          loop  ;; label = @4
            local.get 0
            local.get 0
            i32.load
            local.get 7
            i32.mul
            i32.store
            local.get 0
            i32.const 4
            i32.add
            local.set 0
            local.get 11
            i32.const -1
            i32.add
            local.tee 11
            br_if 0 (;@4;)
          end
        end
        local.get 5
        local.get 4
        i32.sub
        i32.const -4
        i32.gt_u
        br_if 1 (;@1;)
        local.get 4
        local.get 9
        i32.sub
        local.set 11
        local.get 3
        local.get 9
        i32.const 2
        i32.shl
        i32.add
        local.set 0
        loop  ;; label = @3
          local.get 0
          local.get 0
          i32.load
          local.get 7
          i32.mul
          i32.store
          local.get 0
          i32.const 4
          i32.add
          local.tee 9
          local.get 9
          i32.load
          local.get 7
          i32.mul
          i32.store
          local.get 0
          i32.const 8
          i32.add
          local.tee 9
          local.get 9
          i32.load
          local.get 7
          i32.mul
          i32.store
          local.get 0
          i32.const 12
          i32.add
          local.tee 9
          local.get 9
          i32.load
          local.get 7
          i32.mul
          i32.store
          local.get 0
          i32.const 16
          i32.add
          local.set 0
          local.get 11
          i32.const -4
          i32.add
          local.tee 11
          br_if 0 (;@3;)
          br 2 (;@1;)
        end
      end
      i32.const 0
      local.set 13
      local.get 3
      i32.const 0
      local.get 4
      i32.const 2
      i32.shl
      call $memset
      drop
    end
    local.get 13)
  (func $qsort_trinkle (type 15) (param i32 i32 i32 i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 736
    i32.sub
    local.tee 7
    global.set $__stack_pointer
    local.get 7
    local.get 0
    i32.store
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    block  ;; label = @9
                      block  ;; label = @10
                        block  ;; label = @11
                          block  ;; label = @12
                            local.get 2
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            i32.eqz
                            br_if 1 (;@11;)
                          end
                          local.get 0
                          local.get 6
                          local.get 4
                          i32.const 2
                          i32.shl
                          i32.add
                          local.tee 8
                          i32.load
                          i32.sub
                          local.tee 9
                          local.get 0
                          local.get 1
                          call_indirect (type 5)
                          i32.const 1
                          i32.lt_s
                          br_if 0 (;@11;)
                          block  ;; label = @12
                            local.get 5
                            br_if 0 (;@12;)
                            local.get 4
                            i32.const 2
                            i32.lt_s
                            br_if 0 (;@12;)
                            local.get 8
                            i32.const -8
                            i32.add
                            i32.load
                            local.set 5
                            local.get 0
                            i32.const -4
                            i32.add
                            local.tee 8
                            local.get 9
                            local.get 1
                            call_indirect (type 5)
                            i32.const -1
                            i32.gt_s
                            br_if 4 (;@8;)
                            local.get 8
                            local.get 5
                            i32.sub
                            local.get 9
                            local.get 1
                            call_indirect (type 5)
                            i32.const -1
                            i32.gt_s
                            br_if 4 (;@8;)
                          end
                          local.get 7
                          local.get 9
                          i32.store offset=4
                          i32.const 0
                          local.get 3
                          local.get 2
                          i32.const -1
                          i32.add
                          i32.ctz
                          local.tee 5
                          local.get 3
                          i32.ctz
                          local.tee 8
                          i32.const 32
                          i32.add
                          i32.const 0
                          local.get 8
                          select
                          local.get 5
                          select
                          local.tee 8
                          i32.const 31
                          i32.gt_u
                          local.tee 10
                          select
                          local.tee 11
                          local.get 8
                          i32.const -32
                          i32.add
                          local.get 8
                          local.get 10
                          select
                          local.tee 12
                          i32.shr_u
                          local.set 5
                          local.get 8
                          local.get 4
                          i32.add
                          local.set 4
                          block  ;; label = @12
                            local.get 11
                            i32.const 32
                            local.get 12
                            i32.sub
                            i32.shl
                            local.get 3
                            local.get 2
                            local.get 10
                            select
                            local.get 12
                            i32.shr_u
                            i32.or
                            local.tee 3
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 5
                            i32.eqz
                            br_if 5 (;@7;)
                          end
                          local.get 7
                          i32.const 8
                          i32.or
                          local.set 8
                          i32.const 2
                          local.set 12
                          block  ;; label = @12
                            loop  ;; label = @13
                              block  ;; label = @14
                                local.get 9
                                local.get 6
                                local.get 4
                                i32.const 2
                                i32.shl
                                i32.add
                                local.tee 10
                                i32.load
                                i32.sub
                                local.tee 2
                                local.get 0
                                local.get 1
                                call_indirect (type 5)
                                i32.const 1
                                i32.ge_s
                                br_if 0 (;@14;)
                                local.get 9
                                local.set 2
                                br 2 (;@12;)
                              end
                              block  ;; label = @14
                                local.get 4
                                i32.const 2
                                i32.lt_s
                                br_if 0 (;@14;)
                                local.get 10
                                i32.const -8
                                i32.add
                                i32.load
                                local.set 10
                                block  ;; label = @15
                                  local.get 9
                                  i32.const -4
                                  i32.add
                                  local.tee 11
                                  local.get 2
                                  local.get 1
                                  call_indirect (type 5)
                                  i32.const -1
                                  i32.le_s
                                  br_if 0 (;@15;)
                                  local.get 9
                                  local.set 2
                                  br 3 (;@12;)
                                end
                                local.get 11
                                local.get 10
                                i32.sub
                                local.get 2
                                local.get 1
                                call_indirect (type 5)
                                i32.const -1
                                i32.le_s
                                br_if 0 (;@14;)
                                local.get 9
                                local.set 2
                                br 2 (;@12;)
                              end
                              local.get 8
                              local.get 2
                              i32.store
                              local.get 5
                              local.get 3
                              local.get 3
                              i32.const -1
                              i32.add
                              i32.ctz
                              local.tee 9
                              local.get 5
                              i32.ctz
                              local.tee 10
                              i32.const 32
                              i32.add
                              i32.const 0
                              local.get 10
                              select
                              local.get 9
                              select
                              local.tee 9
                              i32.const 31
                              i32.gt_u
                              local.tee 10
                              select
                              local.set 11
                              i32.const 0
                              local.get 5
                              local.get 10
                              select
                              local.tee 13
                              local.get 9
                              i32.const -32
                              i32.add
                              local.get 9
                              local.get 10
                              select
                              local.tee 3
                              i32.shr_u
                              local.set 5
                              local.get 9
                              local.get 4
                              i32.add
                              local.set 4
                              local.get 8
                              i32.const 4
                              i32.add
                              local.set 8
                              local.get 12
                              i32.const 1
                              i32.add
                              local.set 12
                              local.get 2
                              local.set 9
                              local.get 13
                              i32.const 32
                              local.get 3
                              i32.sub
                              i32.shl
                              local.get 11
                              local.get 3
                              i32.shr_u
                              i32.or
                              local.tee 3
                              i32.const 1
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 2
                              local.set 9
                              local.get 5
                              br_if 0 (;@13;)
                            end
                          end
                          local.get 12
                          i32.const 2
                          i32.lt_u
                          br_if 7 (;@4;)
                          local.get 7
                          local.get 0
                          i32.load align=1
                          i32.store offset=480
                          local.get 7
                          local.get 12
                          i32.const 2
                          i32.shl
                          i32.add
                          local.get 7
                          i32.const 480
                          i32.add
                          i32.store
                          local.get 12
                          i32.const -2
                          i32.add
                          local.tee 14
                          i32.const 2
                          i32.ge_u
                          br_if 1 (;@10;)
                          i32.const 0
                          local.set 10
                          br 2 (;@9;)
                        end
                        local.get 5
                        i32.eqz
                        br_if 7 (;@3;)
                        br 9 (;@1;)
                      end
                      local.get 14
                      i32.const 1
                      i32.shr_u
                      i32.const 1
                      i32.add
                      i32.const 2147483646
                      i32.and
                      local.set 11
                      i32.const 0
                      local.set 10
                      local.get 7
                      local.set 5
                      loop  ;; label = @10
                        local.get 0
                        local.get 5
                        i32.const 4
                        i32.add
                        local.tee 13
                        i32.load
                        local.tee 9
                        i32.load align=1
                        i32.store align=1
                        local.get 9
                        local.get 5
                        i32.const 8
                        i32.add
                        local.tee 15
                        i32.load
                        local.tee 3
                        i32.load align=1
                        i32.store align=1
                        local.get 3
                        local.get 5
                        i32.const 12
                        i32.add
                        local.tee 16
                        i32.load
                        local.tee 8
                        i32.load align=1
                        i32.store align=1
                        local.get 5
                        local.get 0
                        i32.const 4
                        i32.add
                        i32.store
                        local.get 15
                        local.get 3
                        i32.const 4
                        i32.add
                        i32.store
                        local.get 13
                        local.get 9
                        i32.const 4
                        i32.add
                        i32.store
                        local.get 16
                        local.get 8
                        i32.const 4
                        i32.add
                        i32.store
                        local.get 8
                        local.get 5
                        i32.const 16
                        i32.add
                        local.tee 5
                        i32.load
                        local.tee 0
                        i32.load align=1
                        i32.store align=1
                        local.get 10
                        i32.const 4
                        i32.add
                        local.set 10
                        local.get 11
                        i32.const -2
                        i32.add
                        local.tee 11
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 14
                    i32.const 2
                    i32.and
                    br_if 3 (;@5;)
                    br 2 (;@6;)
                  end
                  local.get 7
                  local.get 0
                  i32.store offset=240
                  br 5 (;@2;)
                end
                local.get 7
                local.get 0
                i32.load align=1
                i32.store offset=480
                local.get 7
                local.get 7
                i32.const 480
                i32.add
                i32.store offset=8
                i32.const 2
                local.set 12
                i32.const 0
                local.set 10
                local.get 9
                local.set 2
              end
              local.get 0
              local.get 7
              local.get 10
              i32.const 2
              i32.shl
              i32.add
              local.tee 5
              i32.const 4
              i32.add
              local.tee 3
              i32.load
              local.tee 9
              i32.load align=1
              i32.store align=1
              local.get 5
              local.get 0
              i32.const 4
              i32.add
              i32.store
              local.get 3
              local.get 9
              i32.const 4
              i32.add
              i32.store
              local.get 9
              local.get 7
              local.get 10
              i32.const 2
              i32.add
              local.tee 10
              i32.const 2
              i32.shl
              i32.add
              local.tee 5
              i32.load
              local.tee 0
              i32.load align=1
              i32.store align=1
            end
            local.get 12
            i32.const 1
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 7
            i32.const 4
            i32.or
            local.get 10
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.load align=1
            local.set 9
            local.get 5
            local.get 0
            i32.const 4
            i32.add
            i32.store
            local.get 0
            local.get 9
            i32.store align=1
          end
          local.get 2
          local.set 0
        end
        local.get 7
        local.get 0
        i32.store offset=240
        local.get 4
        i32.const 1
        i32.le_s
        br_if 1 (;@1;)
      end
      local.get 7
      i32.const 240
      i32.add
      i32.const 4
      i32.or
      local.set 5
      i32.const 1
      local.set 3
      local.get 0
      local.set 2
      block  ;; label = @2
        loop  ;; label = @3
          block  ;; label = @4
            local.get 0
            local.get 2
            i32.const -4
            i32.add
            local.tee 2
            local.get 6
            local.get 4
            i32.const -2
            i32.add
            local.tee 8
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.sub
            local.tee 9
            local.get 1
            call_indirect (type 5)
            i32.const 0
            i32.lt_s
            br_if 0 (;@4;)
            local.get 0
            local.get 2
            local.get 1
            call_indirect (type 5)
            i32.const -1
            i32.gt_s
            br_if 2 (;@2;)
          end
          local.get 5
          local.get 9
          local.get 2
          local.get 9
          local.get 2
          local.get 1
          call_indirect (type 5)
          i32.const -1
          i32.gt_s
          local.tee 10
          select
          local.tee 2
          i32.store
          local.get 5
          i32.const 4
          i32.add
          local.set 5
          local.get 3
          i32.const 1
          i32.add
          local.set 3
          local.get 4
          i32.const -1
          i32.add
          local.get 8
          local.get 10
          select
          local.tee 4
          i32.const 1
          i32.gt_u
          br_if 0 (;@3;)
        end
      end
      local.get 3
      i32.const 2
      i32.lt_u
      br_if 0 (;@1;)
      local.get 7
      local.get 7
      i32.load offset=240
      local.tee 2
      i32.load align=1
      i32.store offset=480
      local.get 7
      i32.const 240
      i32.add
      local.get 3
      i32.const 2
      i32.shl
      i32.add
      local.get 7
      i32.const 480
      i32.add
      i32.store
      block  ;; label = @2
        block  ;; label = @3
          local.get 3
          i32.const -2
          i32.add
          local.tee 11
          i32.const 2
          i32.ge_u
          br_if 0 (;@3;)
          i32.const 0
          local.set 0
          br 1 (;@2;)
        end
        local.get 11
        i32.const 1
        i32.shr_u
        i32.const 1
        i32.add
        i32.const -2
        i32.and
        local.set 8
        i32.const 0
        local.set 0
        local.get 7
        i32.const 240
        i32.add
        local.set 4
        loop  ;; label = @3
          local.get 2
          local.get 4
          i32.const 4
          i32.add
          local.tee 10
          i32.load
          local.tee 1
          i32.load align=1
          i32.store align=1
          local.get 1
          local.get 4
          i32.const 8
          i32.add
          local.tee 6
          i32.load
          local.tee 5
          i32.load align=1
          i32.store align=1
          local.get 5
          local.get 4
          i32.const 12
          i32.add
          local.tee 12
          i32.load
          local.tee 9
          i32.load align=1
          i32.store align=1
          local.get 4
          local.get 2
          i32.const 4
          i32.add
          i32.store
          local.get 6
          local.get 5
          i32.const 4
          i32.add
          i32.store
          local.get 10
          local.get 1
          i32.const 4
          i32.add
          i32.store
          local.get 12
          local.get 9
          i32.const 4
          i32.add
          i32.store
          local.get 9
          local.get 4
          i32.const 16
          i32.add
          local.tee 4
          i32.load
          local.tee 2
          i32.load align=1
          i32.store align=1
          local.get 0
          i32.const 4
          i32.add
          local.set 0
          local.get 8
          i32.const -2
          i32.add
          local.tee 8
          br_if 0 (;@3;)
        end
      end
      local.get 3
      i32.const 1
      i32.and
      local.set 1
      block  ;; label = @2
        local.get 11
        i32.const 2
        i32.and
        br_if 0 (;@2;)
        local.get 2
        local.get 7
        i32.const 240
        i32.add
        local.get 0
        i32.const 2
        i32.shl
        i32.add
        local.tee 4
        i32.const 4
        i32.add
        local.tee 9
        i32.load
        local.tee 5
        i32.load align=1
        i32.store align=1
        local.get 4
        local.get 2
        i32.const 4
        i32.add
        i32.store
        local.get 9
        local.get 5
        i32.const 4
        i32.add
        i32.store
        local.get 5
        local.get 7
        i32.const 240
        i32.add
        local.get 0
        i32.const 2
        i32.add
        local.tee 0
        i32.const 2
        i32.shl
        i32.add
        local.tee 4
        i32.load
        local.tee 2
        i32.load align=1
        i32.store align=1
      end
      local.get 1
      i32.eqz
      br_if 0 (;@1;)
      local.get 7
      i32.const 240
      i32.add
      local.get 0
      i32.const 2
      i32.shl
      i32.add
      i32.const 4
      i32.add
      i32.load
      i32.load align=1
      local.set 1
      local.get 4
      local.get 2
      i32.const 4
      i32.add
      i32.store
      local.get 2
      local.get 1
      i32.store align=1
    end
    local.get 7
    i32.const 736
    i32.add
    global.set $__stack_pointer)
  (func $vorbis_lsp_to_curve (type 16) (param i32 i32 i32 i32 i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    local.tee 8
    local.set 9
    local.get 8
    local.get 4
    i32.const 2
    i32.shl
    i32.const 15
    i32.add
    i32.const -16
    i32.and
    i32.sub
    local.tee 10
    global.set $__stack_pointer
    block  ;; label = @1
      block  ;; label = @2
        local.get 4
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 10
        local.set 8
        local.get 4
        local.set 11
        block  ;; label = @3
          loop  ;; label = @4
            local.get 3
            i32.load
            i32.const 10
            i32.shr_s
            i32.const 20861
            i32.mul
            i32.const 14
            i32.shr_s
            local.tee 12
            i32.const 65536
            i32.ge_u
            br_if 1 (;@3;)
            local.get 8
            local.get 12
            i32.const 7
            i32.shr_u
            i32.const 33554428
            i32.and
            local.tee 13
            i32.const 16788656
            i32.add
            i32.load
            local.tee 14
            local.get 14
            local.get 13
            i32.const 16788660
            i32.add
            i32.load
            i32.sub
            local.get 12
            i32.const 511
            i32.and
            i32.mul
            i32.const 9
            i32.shr_s
            i32.sub
            i32.store
            local.get 3
            i32.const 4
            i32.add
            local.set 3
            local.get 8
            i32.const 4
            i32.add
            local.set 8
            local.get 11
            i32.const -1
            i32.add
            local.tee 11
            i32.eqz
            br_if 2 (;@2;)
            br 0 (;@4;)
          end
        end
        local.get 0
        i32.const 0
        local.get 2
        i32.const 2
        i32.shl
        call $memset
        drop
        br 1 (;@1;)
      end
      local.get 2
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 6
      i32.const 12
      i32.shl
      local.set 15
      local.get 10
      i32.const -4
      i32.add
      local.set 16
      local.get 0
      i32.const 4
      i32.add
      local.set 17
      local.get 1
      i32.const 8
      i32.add
      local.set 18
      local.get 10
      i32.const 12
      i32.add
      local.set 19
      local.get 4
      i32.const 1
      i32.or
      local.set 20
      local.get 4
      i32.const 2147483641
      i32.mul
      local.set 21
      local.get 4
      i32.const 1
      i32.and
      local.set 22
      local.get 4
      i32.const 1
      i32.add
      i32.const 1
      i32.shr_u
      i32.const 2147483634
      i32.mul
      local.set 23
      i32.const 0
      local.set 12
      loop  ;; label = @2
        local.get 7
        local.get 1
        local.get 12
        i32.const 2
        i32.shl
        local.tee 24
        i32.add
        i32.load
        local.tee 25
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.set 14
        i32.const 1
        local.set 26
        i32.const 46341
        local.set 8
        i32.const 46341
        local.set 11
        i32.const 0
        local.set 6
        block  ;; label = @3
          local.get 4
          i32.const 2
          i32.lt_s
          br_if 0 (;@3;)
          local.get 10
          i32.load
          local.get 14
          i32.sub
          local.tee 3
          local.get 3
          i32.const 31
          i32.shr_s
          local.tee 3
          i32.xor
          local.get 3
          i32.sub
          i32.const 46341
          i32.mul
          local.set 11
          local.get 10
          i32.const 4
          i32.add
          i32.load
          local.get 14
          i32.sub
          local.tee 3
          local.get 3
          i32.const 31
          i32.shr_s
          local.tee 3
          i32.xor
          local.get 3
          i32.sub
          i32.const 46341
          i32.mul
          local.set 8
          i32.const 3
          local.set 26
          block  ;; label = @4
            local.get 4
            i32.const 4
            i32.ge_s
            br_if 0 (;@4;)
            i32.const 0
            local.set 6
            br 1 (;@3;)
          end
          i32.const 3
          local.set 26
          i32.const 0
          local.set 6
          local.get 19
          local.set 3
          loop  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 11
                local.get 8
                i32.or
                local.tee 13
                i32.const 33554431
                i32.le_u
                br_if 0 (;@6;)
                local.get 13
                i32.const 25
                i32.shr_u
                i32.const 16788512
                i32.add
                local.set 13
                br 1 (;@5;)
              end
              block  ;; label = @6
                local.get 13
                i32.const 524287
                i32.le_u
                br_if 0 (;@6;)
                local.get 13
                i32.const 19
                i32.shr_u
                i32.const 16788576
                i32.add
                local.set 13
                br 1 (;@5;)
              end
              local.get 13
              i32.const 16
              i32.shr_u
              i32.const 16788640
              i32.add
              local.set 13
            end
            local.get 3
            i32.load
            local.get 14
            i32.sub
            local.tee 27
            local.get 27
            i32.const 31
            i32.shr_s
            local.tee 27
            i32.xor
            local.get 27
            i32.sub
            local.get 8
            local.get 13
            i32.load8_u
            local.tee 13
            i32.shr_u
            i32.mul
            local.set 8
            local.get 3
            i32.const -4
            i32.add
            i32.load
            local.get 14
            i32.sub
            local.tee 27
            local.get 27
            i32.const 31
            i32.shr_s
            local.tee 27
            i32.xor
            local.get 27
            i32.sub
            local.get 11
            local.get 13
            i32.shr_u
            i32.mul
            local.set 11
            local.get 3
            i32.const 8
            i32.add
            local.set 3
            local.get 6
            local.get 13
            i32.add
            local.set 6
            local.get 26
            i32.const 2
            i32.add
            local.tee 26
            local.get 4
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 20
          local.set 26
        end
        block  ;; label = @3
          block  ;; label = @4
            local.get 11
            local.get 8
            i32.or
            local.tee 3
            i32.const 33554431
            i32.le_u
            br_if 0 (;@4;)
            local.get 3
            i32.const 25
            i32.shr_u
            i32.const 16788512
            i32.add
            local.set 3
            br 1 (;@3;)
          end
          block  ;; label = @4
            local.get 3
            i32.const 524287
            i32.le_u
            br_if 0 (;@4;)
            local.get 3
            i32.const 19
            i32.shr_u
            i32.const 16788576
            i32.add
            local.set 3
            br 1 (;@3;)
          end
          local.get 3
          i32.const 16
          i32.shr_u
          i32.const 16788640
          i32.add
          local.set 3
        end
        local.get 3
        i32.load8_u
        local.set 13
        block  ;; label = @3
          block  ;; label = @4
            local.get 22
            i32.eqz
            br_if 0 (;@4;)
            block  ;; label = @5
              block  ;; label = @6
                local.get 16
                local.get 26
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.get 14
                i32.sub
                local.tee 3
                local.get 3
                i32.const 31
                i32.shr_s
                local.tee 3
                i32.xor
                local.get 3
                i32.sub
                local.get 11
                local.get 13
                i32.shr_u
                i32.mul
                local.tee 11
                local.get 8
                local.get 13
                i32.shr_u
                i32.const 14
                i32.shl
                local.tee 26
                i32.or
                local.tee 3
                i32.const 33554431
                i32.le_u
                br_if 0 (;@6;)
                local.get 3
                i32.const 25
                i32.shr_u
                i32.const 16788512
                i32.add
                local.set 3
                br 1 (;@5;)
              end
              block  ;; label = @6
                local.get 3
                i32.const 524287
                i32.le_u
                br_if 0 (;@6;)
                local.get 3
                i32.const 19
                i32.shr_u
                i32.const 16788576
                i32.add
                local.set 3
                br 1 (;@5;)
              end
              local.get 3
              i32.const 16
              i32.shr_u
              i32.const 16788640
              i32.add
              local.set 3
            end
            local.get 26
            local.get 3
            i32.load8_u
            local.tee 8
            i32.shr_u
            local.tee 3
            local.get 3
            i32.mul
            i32.const 16
            i32.shr_u
            i32.const 16384
            local.get 14
            local.get 14
            i32.mul
            i32.const 14
            i32.shr_s
            i32.sub
            i32.mul
            i32.const 14
            i32.shr_u
            local.get 11
            local.get 8
            i32.shr_u
            local.tee 3
            local.get 3
            i32.mul
            i32.const 16
            i32.shr_u
            i32.add
            local.set 3
            local.get 6
            local.get 23
            i32.add
            local.get 13
            i32.add
            local.get 8
            i32.add
            local.set 8
            br 1 (;@3;)
          end
          local.get 11
          local.get 13
          i32.shr_u
          local.tee 3
          local.get 3
          i32.mul
          i32.const 16
          i32.shr_u
          local.get 14
          i32.const 16384
          i32.add
          i32.mul
          local.get 8
          local.get 13
          i32.shr_u
          local.tee 3
          local.get 3
          i32.mul
          i32.const 16
          i32.shr_u
          i32.const 16384
          local.get 14
          i32.sub
          i32.mul
          i32.add
          i32.const 14
          i32.shr_u
          local.set 3
          local.get 6
          local.get 21
          i32.add
          local.get 13
          i32.add
          local.set 8
        end
        local.get 8
        i32.const 1
        i32.shl
        local.get 4
        i32.add
        local.set 8
        block  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.const 65535
            i32.gt_u
            br_if 0 (;@4;)
            local.get 3
            local.set 11
            local.get 3
            i32.const -1
            i32.add
            i32.const 32766
            i32.gt_u
            br_if 1 (;@3;)
            loop  ;; label = @5
              local.get 8
              i32.const -1
              i32.add
              local.set 8
              local.get 3
              i32.const 1
              i32.shl
              local.tee 11
              i32.eqz
              br_if 2 (;@3;)
              local.get 3
              i32.const 16384
              i32.and
              local.set 13
              local.get 11
              local.set 3
              local.get 13
              i32.eqz
              br_if 0 (;@5;)
              br 2 (;@3;)
            end
          end
          local.get 8
          i32.const 1
          i32.add
          local.set 8
          local.get 3
          i32.const 1
          i32.shr_u
          local.set 11
        end
        block  ;; label = @3
          block  ;; label = @4
            local.get 15
            local.get 11
            i32.const 7
            i32.shr_u
            i32.const 252
            i32.and
            local.tee 3
            i32.const 16789456
            i32.add
            i32.load
            local.get 3
            i32.const 16789728
            i32.add
            i32.load
            local.get 11
            i32.const 1023
            i32.and
            i32.mul
            i32.const 10
            i32.shr_s
            i32.sub
            local.get 8
            i32.const 1
            i32.and
            i32.const 2
            i32.shl
            i32.const 16789984
            i32.add
            i32.load
            i32.mul
            local.get 8
            i32.const 1
            i32.shr_s
            i32.const 21
            i32.add
            i32.shr_s
            local.get 5
            i32.mul
            i32.sub
            i32.const 9
            i32.shr_s
            local.tee 8
            i32.const 0
            i32.ge_s
            br_if 0 (;@4;)
            i32.const 2147483647
            local.set 3
            br 1 (;@3;)
          end
          i32.const 0
          local.set 3
          local.get 8
          i32.const 1119
          i32.gt_u
          br_if 0 (;@3;)
          local.get 8
          i32.const 31
          i32.and
          i32.const 2
          i32.shl
          i32.const 16789328
          i32.add
          i32.load
          local.get 8
          i32.const 3
          i32.shr_u
          i32.const 536870908
          i32.and
          i32.const 16789184
          i32.add
          i32.load
          i32.mul
          local.set 3
        end
        local.get 0
        local.get 24
        i32.add
        local.tee 8
        local.get 8
        i32.load
        i32.const 6
        i32.shr_s
        local.get 3
        i32.const 9
        i32.shr_s
        local.tee 13
        i32.mul
        i32.store
        block  ;; label = @3
          local.get 1
          local.get 12
          i32.const 1
          i32.add
          local.tee 12
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.get 25
          i32.ne
          br_if 0 (;@3;)
          local.get 17
          local.get 24
          i32.add
          local.set 3
          local.get 18
          local.get 24
          i32.add
          local.set 8
          loop  ;; label = @4
            local.get 3
            local.get 3
            i32.load
            i32.const 6
            i32.shr_s
            local.get 13
            i32.mul
            i32.store
            local.get 3
            i32.const 4
            i32.add
            local.set 3
            local.get 12
            i32.const 1
            i32.add
            local.set 12
            local.get 8
            i32.load
            local.set 11
            local.get 8
            i32.const 4
            i32.add
            local.set 8
            local.get 11
            local.get 25
            i32.eq
            br_if 0 (;@4;)
          end
        end
        local.get 12
        local.get 2
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    local.get 9
    global.set $__stack_pointer)
  (func $floor0_unpack (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32)
    local.get 0
    i32.load offset=28
    local.set 2
    i32.const 88
    call $malloc
    local.tee 0
    local.get 1
    i32.const 8
    call $oggpack_read
    local.tee 3
    i32.store
    local.get 0
    local.get 1
    i32.const 16
    call $oggpack_read
    local.tee 4
    i32.store offset=4
    local.get 0
    local.get 1
    i32.const 16
    call $oggpack_read
    local.tee 5
    i32.store offset=8
    local.get 0
    local.get 1
    i32.const 6
    call $oggpack_read
    i32.store offset=12
    local.get 0
    local.get 1
    i32.const 8
    call $oggpack_read
    i32.store offset=16
    local.get 0
    local.get 1
    i32.const 4
    call $oggpack_read
    local.tee 6
    i32.const 1
    i32.add
    i32.store offset=20
    block  ;; label = @1
      block  ;; label = @2
        local.get 3
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 4
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 5
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 6
        i32.const 2147483646
        i32.gt_u
        br_if 0 (;@2;)
        local.get 0
        i32.const 24
        i32.add
        local.set 4
        i32.const 0
        local.set 5
        loop  ;; label = @3
          local.get 4
          local.get 1
          i32.const 8
          call $oggpack_read
          local.tee 3
          i32.store
          local.get 3
          i32.const 0
          i32.lt_s
          br_if 1 (;@2;)
          local.get 3
          local.get 2
          i32.load offset=28
          i32.ge_s
          br_if 1 (;@2;)
          local.get 2
          local.get 3
          i32.const 2
          i32.shl
          i32.add
          i32.const 2080
          i32.add
          i32.load
          local.tee 3
          i32.load offset=12
          i32.eqz
          br_if 1 (;@2;)
          local.get 3
          i32.load
          i32.const 0
          i32.le_s
          br_if 1 (;@2;)
          local.get 4
          i32.const 4
          i32.add
          local.set 4
          local.get 5
          i32.const 1
          i32.add
          local.tee 5
          local.get 0
          i32.load offset=20
          i32.ge_s
          br_if 2 (;@1;)
          br 0 (;@3;)
        end
      end
      local.get 0
      call $free
      i32.const 0
      local.set 0
    end
    local.get 0)
  (func $floor0_look (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.load offset=4
    i32.load offset=28
    local.set 0
    i32.const 1
    i32.const 24
    call $calloc
    local.tee 3
    local.get 2
    i32.store offset=16
    local.get 3
    local.get 2
    i32.load
    i32.store offset=8
    local.get 3
    local.get 2
    i32.load offset=8
    local.tee 4
    i32.store offset=4
    local.get 3
    local.get 0
    local.get 1
    i32.load
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee 1
    i32.const 2
    i32.div_s
    local.tee 5
    i32.store
    local.get 3
    local.get 5
    i32.const 2
    i32.shl
    i32.const 4
    i32.add
    call $malloc
    local.tee 6
    i32.store offset=12
    i32.const 0
    local.set 0
    block  ;; label = @1
      local.get 1
      i32.const 2
      i32.lt_s
      br_if 0 (;@1;)
      local.get 4
      i32.const -1
      i32.add
      local.set 7
      local.get 2
      i32.load offset=4
      local.tee 2
      i32.const 2
      i32.div_s
      local.set 8
      local.get 2
      i32.const 1
      i32.add
      local.tee 9
      i32.const 201
      i32.lt_u
      local.tee 10
      local.get 2
      i32.const -200
      i32.add
      i32.const 200
      i32.lt_u
      i32.or
      local.tee 11
      local.get 2
      i32.const -400
      i32.add
      i32.const 202
      i32.lt_u
      i32.or
      local.tee 12
      local.get 2
      i32.const -602
      i32.add
      i32.const 208
      i32.lt_u
      i32.or
      local.tee 13
      local.get 2
      i32.const -810
      i32.add
      i32.const 222
      i32.lt_u
      i32.or
      local.tee 14
      local.get 2
      i32.const -1032
      i32.add
      i32.const 238
      i32.lt_u
      i32.or
      local.tee 15
      local.get 2
      i32.const -1270
      i32.add
      i32.const 262
      i32.lt_u
      i32.or
      local.tee 16
      local.get 2
      i32.const -1532
      i32.add
      i32.const 292
      i32.lt_u
      i32.or
      local.tee 17
      local.get 2
      i32.const -1824
      i32.add
      i32.const 330
      i32.lt_u
      i32.or
      local.tee 18
      local.get 2
      i32.const -2154
      i32.add
      i32.const 372
      i32.lt_u
      i32.or
      local.tee 19
      local.get 2
      i32.const -2526
      i32.add
      i32.const 426
      i32.lt_u
      i32.or
      local.tee 20
      local.get 2
      i32.const -2952
      i32.add
      i32.const 488
      i32.lt_u
      i32.or
      local.tee 21
      local.get 2
      i32.const -3440
      i32.add
      i32.const 566
      i32.lt_u
      i32.or
      local.tee 22
      local.get 2
      i32.const -4006
      i32.add
      i32.const 660
      i32.lt_u
      i32.or
      local.tee 23
      local.get 2
      i32.const -4666
      i32.add
      i32.const 776
      i32.lt_u
      i32.or
      local.tee 24
      local.get 2
      i32.const -5442
      i32.add
      i32.const 926
      i32.lt_u
      i32.or
      local.tee 25
      local.get 2
      i32.const -6368
      i32.add
      i32.const 1116
      i32.lt_u
      i32.or
      local.tee 26
      local.get 2
      i32.const -7484
      i32.add
      i32.const 1372
      i32.lt_u
      i32.or
      local.tee 27
      local.get 2
      i32.const -8856
      i32.add
      i32.const 1714
      i32.lt_u
      i32.or
      local.tee 28
      local.get 2
      i32.const -10570
      i32.add
      i32.const 2182
      i32.lt_u
      i32.or
      local.tee 29
      local.get 2
      i32.const -12752
      i32.add
      i32.const 2830
      i32.lt_u
      i32.or
      local.tee 30
      local.get 2
      i32.const -15582
      i32.add
      i32.const 3742
      i32.lt_u
      i32.or
      local.tee 31
      local.get 2
      i32.const -19324
      i32.add
      i32.const 5038
      i32.lt_u
      i32.or
      local.tee 32
      local.get 2
      i32.const -24362
      i32.add
      i32.const 6886
      i32.lt_u
      i32.or
      local.tee 33
      local.get 2
      i32.const -31248
      i32.add
      i32.const 9546
      i32.lt_u
      i32.or
      local.tee 34
      local.get 2
      i32.const -40794
      i32.add
      i32.const 13380
      i32.lt_u
      i32.or
      i32.const 1
      i32.and
      local.set 35
      local.get 2
      i32.const -54174
      i32.add
      i32.const 18933
      i32.gt_u
      local.set 36
      i32.const 0
      local.set 0
      local.get 6
      local.set 1
      local.get 5
      local.set 37
      loop  ;; label = @2
        i32.const 0
        local.set 38
        i32.const 0
        local.set 2
        i32.const 100
        local.set 39
        block  ;; label = @3
          block  ;; label = @4
            local.get 0
            local.get 5
            i32.div_s
            local.tee 40
            i32.const 100
            i32.lt_u
            br_if 0 (;@4;)
            i32.const 100
            local.set 2
            block  ;; label = @5
              local.get 40
              i32.const -100
              i32.add
              i32.const 100
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 200
              local.set 39
              i32.const 32768
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -200
              i32.add
              i32.const 101
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 301
              local.set 39
              i32.const 200
              local.set 2
              i32.const 65536
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -301
              i32.add
              i32.const 104
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 405
              local.set 39
              i32.const 301
              local.set 2
              i32.const 98304
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -405
              i32.add
              i32.const 111
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 516
              local.set 39
              i32.const 405
              local.set 2
              i32.const 131072
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -516
              i32.add
              i32.const 119
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 635
              local.set 39
              i32.const 516
              local.set 2
              i32.const 163840
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -635
              i32.add
              i32.const 131
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 766
              local.set 39
              i32.const 635
              local.set 2
              i32.const 196608
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -766
              i32.add
              i32.const 146
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 912
              local.set 39
              i32.const 766
              local.set 2
              i32.const 229376
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -912
              i32.add
              i32.const 165
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 1077
              local.set 39
              i32.const 912
              local.set 2
              i32.const 262144
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -1077
              i32.add
              i32.const 186
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 1263
              local.set 39
              i32.const 1077
              local.set 2
              i32.const 294912
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -1263
              i32.add
              i32.const 213
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 1476
              local.set 39
              i32.const 1263
              local.set 2
              i32.const 327680
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -1476
              i32.add
              i32.const 244
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 1720
              local.set 39
              i32.const 1476
              local.set 2
              i32.const 360448
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -1720
              i32.add
              i32.const 283
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 2003
              local.set 39
              i32.const 1720
              local.set 2
              i32.const 393216
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -2003
              i32.add
              i32.const 330
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 2333
              local.set 39
              i32.const 2003
              local.set 2
              i32.const 425984
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -2333
              i32.add
              i32.const 388
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 2721
              local.set 39
              i32.const 2333
              local.set 2
              i32.const 458752
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -2721
              i32.add
              i32.const 463
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 3184
              local.set 39
              i32.const 2721
              local.set 2
              i32.const 491520
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -3184
              i32.add
              i32.const 558
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 3742
              local.set 39
              i32.const 3184
              local.set 2
              i32.const 524288
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -3742
              i32.add
              i32.const 686
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 4428
              local.set 39
              i32.const 3742
              local.set 2
              i32.const 557056
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -4428
              i32.add
              i32.const 857
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 5285
              local.set 39
              i32.const 4428
              local.set 2
              i32.const 589824
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -5285
              i32.add
              i32.const 1091
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 6376
              local.set 39
              i32.const 5285
              local.set 2
              i32.const 622592
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -6376
              i32.add
              i32.const 1415
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 7791
              local.set 39
              i32.const 6376
              local.set 2
              i32.const 655360
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -7791
              i32.add
              i32.const 1871
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 9662
              local.set 39
              i32.const 7791
              local.set 2
              i32.const 688128
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -9662
              i32.add
              i32.const 2519
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 12181
              local.set 39
              i32.const 9662
              local.set 2
              i32.const 720896
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -12181
              i32.add
              i32.const 3443
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 15624
              local.set 39
              i32.const 12181
              local.set 2
              i32.const 753664
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -15624
              i32.add
              i32.const 4773
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 20397
              local.set 39
              i32.const 15624
              local.set 2
              i32.const 786432
              local.set 38
              br 1 (;@4;)
            end
            block  ;; label = @5
              local.get 40
              i32.const -20397
              i32.add
              i32.const 6690
              i32.ge_u
              br_if 0 (;@5;)
              i32.const 27087
              local.set 39
              i32.const 20397
              local.set 2
              i32.const 819200
              local.set 38
              br 1 (;@4;)
            end
            i32.const 884736
            local.set 2
            local.get 40
            i32.const -27087
            i32.add
            i32.const 9466
            i32.gt_u
            br_if 1 (;@3;)
            i32.const 36554
            local.set 39
            i32.const 27087
            local.set 2
            i32.const 851968
            local.set 38
          end
          local.get 40
          local.get 2
          i32.sub
          i32.const 15
          i32.shl
          local.get 39
          local.get 2
          i32.sub
          i32.div_s
          local.get 38
          i32.add
          local.set 2
        end
        local.get 2
        i32.const 11
        i32.shl
        local.set 40
        block  ;; label = @3
          block  ;; label = @4
            local.get 35
            br_if 0 (;@4;)
            i32.const 884736
            local.set 2
            local.get 36
            br_if 1 (;@3;)
          end
          local.get 8
          i32.const 0
          i32.const 100
          local.get 10
          select
          i32.const 200
          local.get 11
          select
          i32.const 301
          local.get 12
          select
          i32.const 405
          local.get 13
          select
          i32.const 516
          local.get 14
          select
          i32.const 635
          local.get 15
          select
          i32.const 766
          local.get 16
          i32.const 1
          i32.and
          local.tee 2
          select
          i32.const 912
          local.get 17
          i32.const 1
          i32.and
          local.tee 38
          select
          i32.const 1077
          local.get 18
          i32.const 1
          i32.and
          local.tee 39
          select
          i32.const 1263
          local.get 19
          i32.const 1
          i32.and
          local.tee 41
          select
          i32.const 1476
          local.get 20
          i32.const 1
          i32.and
          local.tee 42
          select
          i32.const 1720
          local.get 21
          i32.const 1
          i32.and
          local.tee 43
          select
          i32.const 2003
          local.get 22
          i32.const 1
          i32.and
          local.tee 44
          select
          i32.const 2333
          local.get 23
          i32.const 1
          i32.and
          local.tee 45
          select
          i32.const 2721
          local.get 24
          i32.const 1
          i32.and
          local.tee 46
          select
          i32.const 3184
          local.get 25
          i32.const 1
          i32.and
          local.tee 47
          select
          i32.const 3742
          local.get 26
          i32.const 1
          i32.and
          local.tee 48
          select
          i32.const 4428
          local.get 27
          i32.const 1
          i32.and
          local.tee 49
          select
          i32.const 5285
          local.get 28
          i32.const 1
          i32.and
          local.tee 50
          select
          i32.const 6376
          local.get 29
          i32.const 1
          i32.and
          local.tee 51
          select
          i32.const 7791
          local.get 30
          i32.const 1
          i32.and
          local.tee 52
          select
          i32.const 9662
          local.get 31
          i32.const 1
          i32.and
          local.tee 53
          select
          i32.const 12181
          local.get 32
          i32.const 1
          i32.and
          local.tee 54
          select
          i32.const 15624
          local.get 33
          i32.const 1
          i32.and
          local.tee 55
          select
          i32.const 20397
          local.get 34
          i32.const 1
          i32.and
          local.tee 56
          select
          i32.const 27087
          local.get 35
          select
          local.tee 57
          i32.sub
          i32.const 15
          i32.shl
          i32.const 100
          i32.const 200
          local.get 10
          select
          i32.const 301
          local.get 11
          select
          i32.const 405
          local.get 12
          select
          i32.const 516
          local.get 13
          select
          i32.const 635
          local.get 14
          select
          i32.const 766
          local.get 15
          select
          i32.const 912
          local.get 2
          select
          i32.const 1077
          local.get 38
          select
          i32.const 1263
          local.get 39
          select
          i32.const 1476
          local.get 41
          select
          i32.const 1720
          local.get 42
          select
          i32.const 2003
          local.get 43
          select
          i32.const 2333
          local.get 44
          select
          i32.const 2721
          local.get 45
          select
          i32.const 3184
          local.get 46
          select
          i32.const 3742
          local.get 47
          select
          i32.const 4428
          local.get 48
          select
          i32.const 5285
          local.get 49
          select
          i32.const 6376
          local.get 50
          select
          i32.const 7791
          local.get 51
          select
          i32.const 9662
          local.get 52
          select
          i32.const 12181
          local.get 53
          select
          i32.const 15624
          local.get 54
          select
          i32.const 20397
          local.get 55
          select
          i32.const 27087
          local.get 56
          select
          i32.const 36554
          local.get 35
          select
          local.get 57
          i32.sub
          i32.div_s
          local.get 9
          i32.const 200
          i32.gt_u
          i32.const 15
          i32.shl
          i32.const 65536
          local.get 11
          select
          i32.const 98304
          local.get 12
          select
          i32.const 131072
          local.get 13
          select
          i32.const 163840
          local.get 14
          select
          i32.const 196608
          local.get 15
          select
          i32.const 229376
          local.get 2
          select
          i32.const 262144
          local.get 38
          select
          i32.const 294912
          local.get 39
          select
          i32.const 327680
          local.get 41
          select
          i32.const 360448
          local.get 42
          select
          i32.const 393216
          local.get 43
          select
          i32.const 425984
          local.get 44
          select
          i32.const 458752
          local.get 45
          select
          i32.const 491520
          local.get 46
          select
          i32.const 524288
          local.get 47
          select
          i32.const 557056
          local.get 48
          select
          i32.const 589824
          local.get 49
          select
          i32.const 622592
          local.get 50
          select
          i32.const 655360
          local.get 51
          select
          i32.const 688128
          local.get 52
          select
          i32.const 720896
          local.get 53
          select
          i32.const 753664
          local.get 54
          select
          i32.const 786432
          local.get 55
          select
          i32.const 819200
          local.get 56
          select
          i32.const 851968
          local.get 35
          select
          i32.add
          local.set 2
        end
        local.get 1
        local.get 40
        local.get 2
        i32.div_s
        local.get 4
        i32.mul
        i32.const 11
        i32.shr_s
        local.tee 2
        local.get 7
        local.get 2
        local.get 4
        i32.lt_s
        select
        i32.store
        local.get 0
        local.get 8
        i32.add
        local.set 0
        local.get 1
        i32.const 4
        i32.add
        local.set 1
        local.get 37
        i32.const -1
        i32.add
        local.tee 37
        br_if 0 (;@2;)
      end
      local.get 5
      local.set 0
    end
    local.get 6
    local.get 0
    i32.const 2
    i32.shl
    i32.add
    i32.const -1
    i32.store
    local.get 3
    local.get 4
    i32.const 2
    i32.shl
    call $malloc
    local.tee 2
    i32.store offset=20
    block  ;; label = @1
      local.get 4
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      i32.const 0
      local.set 0
      local.get 4
      local.set 40
      loop  ;; label = @2
        local.get 2
        i32.const 131072
        local.get 0
        local.get 4
        i32.div_s
        i32.const 131071
        i32.and
        local.tee 1
        i32.sub
        local.get 1
        local.get 1
        i32.const 65536
        i32.gt_u
        select
        local.tee 1
        i32.const 511
        i32.and
        local.get 1
        i32.const 7
        i32.shr_u
        i32.const 2044
        i32.and
        local.tee 1
        i32.const 16788660
        i32.add
        i32.load
        local.get 1
        i32.const 16788656
        i32.add
        i32.load
        local.tee 1
        i32.sub
        i32.mul
        local.get 1
        i32.const 9
        i32.shl
        i32.add
        i32.const 9
        i32.shr_s
        i32.store
        local.get 0
        i32.const 65536
        i32.add
        local.set 0
        local.get 2
        i32.const 4
        i32.add
        local.set 2
        local.get 40
        i32.const -1
        i32.add
        local.tee 40
        br_if 0 (;@2;)
      end
    end
    local.get 3)
  (func $floor0_free_info (type 4) (param i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      call $free
    end)
  (func $floor0_free_look (type 4) (param i32)
    (local i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 0
        i32.load offset=12
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      block  ;; label = @2
        local.get 0
        i32.load offset=20
        local.tee 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 1
        call $free
      end
      local.get 0
      call $free
    end)
  (func $floor0_inverse1 (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.const 4
      i32.add
      local.tee 2
      local.get 1
      i32.load offset=16
      local.tee 3
      i32.load offset=12
      call $oggpack_read
      local.tee 4
      i32.const 1
      i32.ge_s
      br_if 0 (;@1;)
      i32.const 0
      return
    end
    local.get 4
    local.get 3
    i32.load offset=16
    i32.mul
    i32.const 4
    i32.shl
    i32.const -1
    local.get 3
    i32.load offset=12
    i32.shl
    i32.const -1
    i32.xor
    i32.div_s
    local.set 5
    i32.const 0
    local.set 6
    i32.const 0
    local.set 7
    block  ;; label = @1
      local.get 3
      i32.load offset=20
      local.tee 4
      i32.eqz
      br_if 0 (;@1;)
      i32.const 0
      local.set 7
      loop  ;; label = @2
        local.get 7
        i32.const 1
        i32.add
        local.set 7
        local.get 4
        i32.const 1
        i32.gt_u
        local.set 8
        local.get 4
        i32.const 1
        i32.shr_u
        local.set 4
        local.get 8
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 2
      local.get 7
      call $oggpack_read
      local.tee 4
      i32.const -1
      i32.eq
      br_if 0 (;@1;)
      local.get 4
      local.get 3
      i32.load offset=20
      i32.ge_s
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=64
      i32.load offset=4
      i32.load offset=28
      i32.load offset=3104
      local.tee 7
      local.get 3
      local.get 4
      i32.const 2
      i32.shl
      i32.add
      i32.const 24
      i32.add
      i32.load
      local.tee 8
      i32.const 52
      i32.mul
      i32.add
      local.set 9
      local.get 0
      i32.load offset=68
      local.set 10
      block  ;; label = @2
        local.get 0
        i32.load offset=72
        local.tee 11
        local.get 1
        i32.load offset=8
        local.tee 12
        i32.const 2
        i32.shl
        i32.const 11
        i32.add
        i32.const -8
        i32.and
        local.tee 4
        i32.add
        local.get 0
        i32.load offset=76
        i32.le_s
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 10
          i32.eqz
          br_if 0 (;@3;)
          i32.const 8
          call $malloc
          local.tee 3
          local.get 10
          i32.store
          local.get 0
          i32.load offset=84
          local.set 12
          local.get 0
          local.get 3
          i32.store offset=84
          local.get 3
          local.get 12
          i32.store offset=4
          local.get 0
          local.get 0
          i32.load offset=80
          local.get 11
          i32.add
          i32.store offset=80
        end
        local.get 0
        local.get 4
        i32.store offset=76
        local.get 0
        local.get 4
        call $malloc
        local.tee 10
        i32.store offset=68
        local.get 1
        i32.load offset=8
        local.set 12
        i32.const 0
        local.set 11
      end
      local.get 0
      local.get 11
      local.get 4
      i32.add
      i32.store offset=72
      local.get 10
      local.get 11
      i32.add
      local.set 6
      block  ;; label = @2
        block  ;; label = @3
          local.get 9
          i32.const 8
          i32.add
          i32.load
          i32.const 0
          i32.gt_s
          br_if 0 (;@3;)
          local.get 12
          i32.const 1
          i32.lt_s
          br_if 1 (;@2;)
          local.get 6
          i32.const 0
          local.get 12
          i32.const 2
          i32.shl
          call $memset
          drop
          br 1 (;@2;)
        end
        block  ;; label = @3
          block  ;; label = @4
            i32.const -24
            local.get 7
            local.get 8
            i32.const 52
            i32.mul
            i32.add
            i32.const 12
            i32.add
            i32.load
            local.tee 4
            i32.sub
            local.tee 13
            i32.const -1
            i32.gt_s
            br_if 0 (;@4;)
            local.get 12
            i32.const 1
            i32.lt_s
            br_if 2 (;@2;)
            local.get 4
            i32.const 24
            i32.add
            local.set 13
            local.get 10
            local.get 11
            i32.add
            local.set 14
            local.get 7
            local.get 8
            i32.const 52
            i32.mul
            i32.add
            i32.const 16
            i32.add
            local.set 15
            i32.const 0
            local.set 16
            br 1 (;@3;)
          end
          local.get 12
          i32.const 1
          i32.lt_s
          br_if 1 (;@2;)
          local.get 10
          local.get 11
          i32.add
          local.set 14
          local.get 7
          local.get 8
          i32.const 52
          i32.mul
          i32.add
          i32.const 16
          i32.add
          local.set 15
          i32.const 0
          local.set 16
          loop  ;; label = @4
            block  ;; label = @5
              local.get 9
              local.get 2
              call $decode_packed_entry_number
              local.tee 4
              i32.const -1
              i32.ne
              br_if 0 (;@5;)
              i32.const 0
              return
            end
            block  ;; label = @5
              local.get 16
              local.get 12
              i32.ge_s
              br_if 0 (;@5;)
              local.get 9
              i32.load
              local.tee 17
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 15
              i32.load
              local.get 17
              local.get 4
              i32.mul
              i32.const 2
              i32.shl
              i32.add
              local.set 7
              local.get 14
              local.get 16
              i32.const 2
              i32.shl
              i32.add
              local.set 8
              i32.const 1
              local.set 4
              block  ;; label = @6
                loop  ;; label = @7
                  local.get 8
                  local.get 7
                  i32.load
                  local.get 13
                  i32.shr_s
                  i32.store
                  local.get 4
                  i32.const 1
                  i32.add
                  local.set 3
                  local.get 16
                  local.get 4
                  i32.add
                  local.get 12
                  i32.ge_s
                  br_if 1 (;@6;)
                  local.get 8
                  i32.const 4
                  i32.add
                  local.set 8
                  local.get 7
                  i32.const 4
                  i32.add
                  local.set 7
                  local.get 4
                  local.get 17
                  i32.lt_s
                  local.set 0
                  local.get 3
                  local.set 4
                  local.get 0
                  br_if 0 (;@7;)
                end
              end
              local.get 16
              local.get 3
              i32.add
              i32.const -1
              i32.add
              local.set 16
            end
            local.get 16
            local.get 12
            i32.ge_s
            br_if 2 (;@2;)
            br 0 (;@4;)
          end
        end
        loop  ;; label = @3
          block  ;; label = @4
            local.get 9
            local.get 2
            call $decode_packed_entry_number
            local.tee 4
            i32.const -1
            i32.ne
            br_if 0 (;@4;)
            i32.const 0
            return
          end
          block  ;; label = @4
            local.get 16
            local.get 12
            i32.ge_s
            br_if 0 (;@4;)
            local.get 9
            i32.load
            local.tee 17
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 15
            i32.load
            local.get 17
            local.get 4
            i32.mul
            i32.const 2
            i32.shl
            i32.add
            local.set 7
            local.get 14
            local.get 16
            i32.const 2
            i32.shl
            i32.add
            local.set 8
            i32.const 1
            local.set 4
            block  ;; label = @5
              loop  ;; label = @6
                local.get 8
                local.get 7
                i32.load
                local.get 13
                i32.shl
                i32.store
                local.get 4
                i32.const 1
                i32.add
                local.set 3
                local.get 16
                local.get 4
                i32.add
                local.get 12
                i32.ge_s
                br_if 1 (;@5;)
                local.get 8
                i32.const 4
                i32.add
                local.set 8
                local.get 7
                i32.const 4
                i32.add
                local.set 7
                local.get 4
                local.get 17
                i32.lt_s
                local.set 0
                local.get 3
                local.set 4
                local.get 0
                br_if 0 (;@6;)
              end
            end
            local.get 16
            local.get 3
            i32.add
            i32.const -1
            i32.add
            local.set 16
          end
          local.get 16
          local.get 12
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.load offset=8
        local.tee 3
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 6
        i32.const -4
        i32.add
        local.set 12
        local.get 10
        local.get 11
        i32.add
        local.set 17
        i32.const 0
        local.set 0
        i32.const 0
        local.set 4
        loop  ;; label = @3
          block  ;; label = @4
            local.get 4
            local.get 3
            i32.ge_s
            br_if 0 (;@4;)
            local.get 4
            local.get 9
            i32.load
            local.tee 7
            i32.const 0
            local.get 7
            i32.const 0
            i32.gt_s
            select
            local.tee 8
            i32.add
            local.set 16
            block  ;; label = @5
              local.get 7
              i32.const 1
              i32.ge_s
              br_if 0 (;@5;)
              local.get 16
              local.set 4
              br 1 (;@4;)
            end
            local.get 4
            i32.const 1
            i32.add
            local.set 7
            local.get 17
            local.get 4
            i32.const 2
            i32.shl
            i32.add
            local.set 4
            block  ;; label = @5
              loop  ;; label = @6
                local.get 4
                local.get 4
                i32.load
                local.get 0
                i32.add
                i32.store
                local.get 7
                local.get 1
                i32.load offset=8
                local.tee 3
                i32.ge_s
                br_if 1 (;@5;)
                local.get 4
                i32.const 4
                i32.add
                local.set 4
                local.get 7
                i32.const 1
                i32.add
                local.set 7
                local.get 8
                i32.const -1
                i32.add
                local.tee 8
                br_if 0 (;@6;)
              end
              local.get 16
              local.set 4
              br 1 (;@4;)
            end
            local.get 7
            local.set 4
          end
          local.get 12
          local.get 4
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.set 0
          local.get 4
          local.get 3
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 6
      local.get 3
      i32.const 2
      i32.shl
      i32.add
      local.get 5
      i32.store
    end
    local.get 6)
  (func $floor0_inverse2 (type 2) (param i32 i32 i32 i32) (result i32)
    (local i32)
    block  ;; label = @1
      local.get 2
      i32.eqz
      br_if 0 (;@1;)
      local.get 3
      local.get 1
      i32.load offset=12
      local.get 1
      i32.load
      local.get 2
      local.get 1
      i32.load offset=8
      local.tee 4
      local.get 2
      local.get 4
      i32.const 2
      i32.shl
      i32.add
      i32.load
      local.get 1
      i32.load offset=16
      i32.load offset=16
      local.get 1
      i32.load offset=20
      call $vorbis_lsp_to_curve
      i32.const 1
      return
    end
    local.get 3
    i32.const 0
    local.get 1
    i32.load
    i32.const 2
    i32.shl
    call $memset
    drop
    i32.const 0)
  (func $_os_update_crc (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32)
    block  ;; label = @1
      block  ;; label = @2
        local.get 2
        i32.const 8
        i32.ge_s
        br_if 0 (;@2;)
        local.get 2
        local.set 3
        br 1 (;@1;)
      end
      loop  ;; label = @2
        local.get 1
        i32.load align=1
        local.tee 4
        i32.const 24
        i32.shl
        local.get 4
        i32.const 65280
        i32.and
        i32.const 8
        i32.shl
        i32.or
        local.get 4
        i32.const 8
        i32.shr_u
        i32.const 65280
        i32.and
        local.get 4
        i32.const 24
        i32.shr_u
        i32.or
        i32.or
        local.get 0
        i32.xor
        local.tee 0
        i32.const 14
        i32.shr_u
        i32.const 1020
        i32.and
        i32.const 16796160
        i32.add
        i32.load
        local.get 0
        i32.const 22
        i32.shr_u
        i32.const 1020
        i32.and
        i32.const 16797184
        i32.add
        i32.load
        i32.xor
        local.get 0
        i32.const 6
        i32.shr_u
        i32.const 1020
        i32.and
        i32.const 16795136
        i32.add
        i32.load
        i32.xor
        local.get 0
        i32.const 255
        i32.and
        i32.const 2
        i32.shl
        i32.const 16794112
        i32.add
        i32.load
        i32.xor
        local.get 1
        i32.const 4
        i32.add
        i32.load8_u
        i32.const 2
        i32.shl
        i32.const 16793088
        i32.add
        i32.load
        i32.xor
        local.get 1
        i32.const 5
        i32.add
        i32.load8_u
        i32.const 2
        i32.shl
        i32.const 16792064
        i32.add
        i32.load
        i32.xor
        local.get 1
        i32.const 6
        i32.add
        i32.load8_u
        i32.const 2
        i32.shl
        i32.const 16791040
        i32.add
        i32.load
        i32.xor
        local.get 1
        i32.const 7
        i32.add
        i32.load8_u
        i32.const 2
        i32.shl
        i32.const 16790016
        i32.add
        i32.load
        i32.xor
        local.set 0
        local.get 1
        i32.const 8
        i32.add
        local.set 1
        local.get 2
        i32.const 15
        i32.gt_u
        local.set 4
        local.get 2
        i32.const -8
        i32.add
        local.tee 3
        local.set 2
        local.get 4
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 3
          i32.const 1
          i32.and
          br_if 0 (;@3;)
          local.get 3
          local.set 4
          br 1 (;@2;)
        end
        local.get 0
        i32.const 24
        i32.shr_u
        local.get 1
        i32.load8_u
        i32.xor
        i32.const 2
        i32.shl
        i32.const 16790016
        i32.add
        i32.load
        local.get 0
        i32.const 8
        i32.shl
        i32.xor
        local.set 0
        local.get 1
        i32.const 1
        i32.add
        local.set 1
        local.get 3
        i32.const -1
        i32.add
        local.set 4
      end
      local.get 3
      i32.const 1
      i32.eq
      br_if 0 (;@1;)
      loop  ;; label = @2
        local.get 0
        i32.const 24
        i32.shr_u
        local.get 1
        i32.load8_u
        i32.xor
        i32.const 2
        i32.shl
        i32.const 16790016
        i32.add
        i32.load
        local.get 0
        i32.const 8
        i32.shl
        i32.xor
        local.tee 0
        i32.const 24
        i32.shr_u
        local.get 1
        i32.const 1
        i32.add
        i32.load8_u
        i32.xor
        i32.const 2
        i32.shl
        i32.const 16790016
        i32.add
        i32.load
        local.get 0
        i32.const 8
        i32.shl
        i32.xor
        local.set 0
        local.get 1
        i32.const 2
        i32.add
        local.set 1
        local.get 4
        i32.const -2
        i32.add
        local.tee 4
        br_if 0 (;@2;)
      end
    end
    local.get 0)
  (func $memmove (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      local.get 1
      i32.eq
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 1
        local.get 0
        local.get 2
        i32.add
        local.tee 3
        i32.sub
        i32.const 0
        local.get 2
        i32.const 1
        i32.shl
        i32.sub
        i32.gt_u
        br_if 0 (;@2;)
        local.get 0
        local.get 1
        local.get 2
        call $memcpy
        drop
        br 1 (;@1;)
      end
      local.get 1
      local.get 0
      i32.xor
      i32.const 3
      i32.and
      local.set 4
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 0
            local.get 1
            i32.ge_u
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 4
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              local.set 5
              local.get 0
              local.set 3
              br 3 (;@2;)
            end
            block  ;; label = @5
              local.get 0
              i32.const 3
              i32.and
              br_if 0 (;@5;)
              local.get 2
              local.set 5
              local.get 0
              local.set 3
              br 2 (;@3;)
            end
            local.get 2
            i32.eqz
            br_if 3 (;@1;)
            local.get 0
            local.get 1
            i32.load8_u
            i32.store8
            local.get 2
            i32.const -1
            i32.add
            local.set 5
            block  ;; label = @5
              local.get 0
              i32.const 1
              i32.add
              local.tee 3
              i32.const 3
              i32.and
              br_if 0 (;@5;)
              local.get 1
              i32.const 1
              i32.add
              local.set 1
              br 2 (;@3;)
            end
            local.get 5
            i32.eqz
            br_if 3 (;@1;)
            local.get 0
            local.get 1
            i32.load8_u offset=1
            i32.store8 offset=1
            local.get 2
            i32.const -2
            i32.add
            local.set 5
            block  ;; label = @5
              local.get 0
              i32.const 2
              i32.add
              local.tee 3
              i32.const 3
              i32.and
              br_if 0 (;@5;)
              local.get 1
              i32.const 2
              i32.add
              local.set 1
              br 2 (;@3;)
            end
            local.get 5
            i32.eqz
            br_if 3 (;@1;)
            local.get 0
            local.get 1
            i32.load8_u offset=2
            i32.store8 offset=2
            local.get 2
            i32.const -3
            i32.add
            local.set 5
            block  ;; label = @5
              local.get 0
              i32.const 3
              i32.add
              local.tee 3
              i32.const 3
              i32.and
              br_if 0 (;@5;)
              local.get 1
              i32.const 3
              i32.add
              local.set 1
              br 2 (;@3;)
            end
            local.get 5
            i32.eqz
            br_if 3 (;@1;)
            local.get 0
            local.get 1
            i32.load8_u offset=3
            i32.store8 offset=3
            local.get 0
            i32.const 4
            i32.add
            local.set 3
            local.get 1
            i32.const 4
            i32.add
            local.set 1
            local.get 2
            i32.const -4
            i32.add
            local.set 5
            br 1 (;@3;)
          end
          block  ;; label = @4
            local.get 4
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 3
              i32.const 3
              i32.and
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              i32.eqz
              br_if 4 (;@1;)
              local.get 0
              local.get 2
              i32.const -1
              i32.add
              local.tee 3
              i32.add
              local.tee 4
              local.get 1
              local.get 3
              i32.add
              i32.load8_u
              i32.store8
              block  ;; label = @6
                local.get 4
                i32.const 3
                i32.and
                br_if 0 (;@6;)
                local.get 3
                local.set 2
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 4 (;@1;)
              local.get 0
              local.get 2
              i32.const -2
              i32.add
              local.tee 3
              i32.add
              local.tee 4
              local.get 1
              local.get 3
              i32.add
              i32.load8_u
              i32.store8
              block  ;; label = @6
                local.get 4
                i32.const 3
                i32.and
                br_if 0 (;@6;)
                local.get 3
                local.set 2
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 4 (;@1;)
              local.get 0
              local.get 2
              i32.const -3
              i32.add
              local.tee 3
              i32.add
              local.tee 4
              local.get 1
              local.get 3
              i32.add
              i32.load8_u
              i32.store8
              block  ;; label = @6
                local.get 4
                i32.const 3
                i32.and
                br_if 0 (;@6;)
                local.get 3
                local.set 2
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 4 (;@1;)
              local.get 0
              local.get 2
              i32.const -4
              i32.add
              local.tee 2
              i32.add
              local.get 1
              local.get 2
              i32.add
              i32.load8_u
              i32.store8
            end
            local.get 2
            i32.const 4
            i32.lt_u
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 2
              i32.const -4
              i32.add
              local.tee 6
              i32.const 2
              i32.shr_u
              i32.const 1
              i32.add
              i32.const 3
              i32.and
              local.tee 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 1
              i32.const -4
              i32.add
              local.set 4
              local.get 0
              i32.const -4
              i32.add
              local.set 5
              loop  ;; label = @6
                local.get 5
                local.get 2
                i32.add
                local.get 4
                local.get 2
                i32.add
                i32.load
                i32.store
                local.get 2
                i32.const -4
                i32.add
                local.set 2
                local.get 3
                i32.const -1
                i32.add
                local.tee 3
                br_if 0 (;@6;)
              end
            end
            local.get 6
            i32.const 12
            i32.lt_u
            br_if 0 (;@4;)
            local.get 1
            i32.const -16
            i32.add
            local.set 5
            local.get 0
            i32.const -16
            i32.add
            local.set 6
            loop  ;; label = @5
              local.get 6
              local.get 2
              i32.add
              local.tee 3
              i32.const 12
              i32.add
              local.get 5
              local.get 2
              i32.add
              local.tee 4
              i32.const 12
              i32.add
              i32.load
              i32.store
              local.get 3
              i32.const 8
              i32.add
              local.get 4
              i32.const 8
              i32.add
              i32.load
              i32.store
              local.get 3
              i32.const 4
              i32.add
              local.get 4
              i32.const 4
              i32.add
              i32.load
              i32.store
              local.get 3
              local.get 4
              i32.load
              i32.store
              local.get 2
              i32.const -16
              i32.add
              local.tee 2
              i32.const 3
              i32.gt_u
              br_if 0 (;@5;)
            end
          end
          local.get 2
          i32.eqz
          br_if 2 (;@1;)
          local.get 2
          local.set 3
          block  ;; label = @4
            local.get 2
            i32.const 3
            i32.and
            local.tee 4
            i32.eqz
            br_if 0 (;@4;)
            local.get 1
            i32.const -1
            i32.add
            local.set 5
            local.get 0
            i32.const -1
            i32.add
            local.set 6
            local.get 2
            local.set 3
            loop  ;; label = @5
              local.get 6
              local.get 3
              i32.add
              local.get 5
              local.get 3
              i32.add
              i32.load8_u
              i32.store8
              local.get 3
              i32.const -1
              i32.add
              local.set 3
              local.get 4
              i32.const -1
              i32.add
              local.tee 4
              br_if 0 (;@5;)
            end
          end
          local.get 2
          i32.const 4
          i32.lt_u
          br_if 2 (;@1;)
          local.get 1
          i32.const -4
          i32.add
          local.set 4
          local.get 0
          i32.const -4
          i32.add
          local.set 5
          loop  ;; label = @4
            local.get 5
            local.get 3
            i32.add
            local.tee 1
            i32.const 3
            i32.add
            local.get 4
            local.get 3
            i32.add
            local.tee 2
            i32.const 3
            i32.add
            i32.load8_u
            i32.store8
            local.get 1
            i32.const 2
            i32.add
            local.get 2
            i32.const 2
            i32.add
            i32.load8_u
            i32.store8
            local.get 1
            i32.const 1
            i32.add
            local.get 2
            i32.const 1
            i32.add
            i32.load8_u
            i32.store8
            local.get 1
            local.get 2
            i32.load8_u
            i32.store8
            local.get 3
            i32.const -4
            i32.add
            local.tee 3
            br_if 0 (;@4;)
            br 3 (;@1;)
          end
        end
        local.get 5
        i32.const 4
        i32.lt_u
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 5
          i32.const -4
          i32.add
          local.tee 4
          i32.const 2
          i32.shr_u
          i32.const 1
          i32.add
          i32.const 7
          i32.and
          local.tee 2
          i32.eqz
          br_if 0 (;@3;)
          local.get 2
          i32.const 2
          i32.shl
          local.set 6
          loop  ;; label = @4
            local.get 3
            local.get 1
            i32.load
            i32.store
            local.get 1
            i32.const 4
            i32.add
            local.set 1
            local.get 3
            i32.const 4
            i32.add
            local.set 3
            local.get 2
            i32.const -1
            i32.add
            local.tee 2
            br_if 0 (;@4;)
          end
          local.get 5
          local.get 6
          i32.sub
          local.set 5
        end
        local.get 4
        i32.const 28
        i32.lt_u
        br_if 0 (;@2;)
        loop  ;; label = @3
          local.get 3
          local.get 1
          i32.load
          i32.store
          local.get 3
          local.get 1
          i32.load offset=4
          i32.store offset=4
          local.get 3
          local.get 1
          i32.load offset=8
          i32.store offset=8
          local.get 3
          local.get 1
          i32.load offset=12
          i32.store offset=12
          local.get 3
          local.get 1
          i32.load offset=16
          i32.store offset=16
          local.get 3
          local.get 1
          i32.load offset=20
          i32.store offset=20
          local.get 3
          local.get 1
          i32.load offset=24
          i32.store offset=24
          local.get 3
          local.get 1
          i32.load offset=28
          i32.store offset=28
          local.get 1
          i32.const 32
          i32.add
          local.set 1
          local.get 3
          i32.const 32
          i32.add
          local.set 3
          local.get 5
          i32.const -32
          i32.add
          local.tee 5
          i32.const 3
          i32.gt_u
          br_if 0 (;@3;)
        end
      end
      local.get 5
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 5
          i32.const 7
          i32.and
          local.tee 2
          br_if 0 (;@3;)
          local.get 5
          local.set 4
          br 1 (;@2;)
        end
        local.get 5
        i32.const -8
        i32.and
        local.set 4
        loop  ;; label = @3
          local.get 3
          local.get 1
          i32.load8_u
          i32.store8
          local.get 3
          i32.const 1
          i32.add
          local.set 3
          local.get 1
          i32.const 1
          i32.add
          local.set 1
          local.get 2
          i32.const -1
          i32.add
          local.tee 2
          br_if 0 (;@3;)
        end
      end
      local.get 5
      i32.const 8
      i32.lt_u
      br_if 0 (;@1;)
      loop  ;; label = @2
        local.get 3
        local.get 1
        i32.load8_u
        i32.store8
        local.get 3
        local.get 1
        i32.load8_u offset=1
        i32.store8 offset=1
        local.get 3
        local.get 1
        i32.load8_u offset=2
        i32.store8 offset=2
        local.get 3
        local.get 1
        i32.load8_u offset=3
        i32.store8 offset=3
        local.get 3
        local.get 1
        i32.load8_u offset=4
        i32.store8 offset=4
        local.get 3
        local.get 1
        i32.load8_u offset=5
        i32.store8 offset=5
        local.get 3
        local.get 1
        i32.load8_u offset=6
        i32.store8 offset=6
        local.get 3
        local.get 1
        i32.load8_u offset=7
        i32.store8 offset=7
        local.get 3
        i32.const 8
        i32.add
        local.set 3
        local.get 1
        i32.const 8
        i32.add
        local.set 1
        local.get 4
        i32.const -8
        i32.add
        local.tee 4
        br_if 0 (;@2;)
      end
    end
    local.get 0)
  (func $vorbis_synthesis (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 2
    local.set 3
    local.get 2
    global.set $__stack_pointer
    local.get 0
    local.get 0
    i32.load offset=64
    local.tee 4
    i32.load offset=4
    local.tee 5
    i32.load offset=28
    local.tee 6
    local.get 0
    i32.load offset=28
    i32.const 2
    i32.shl
    i32.add
    i32.load
    local.tee 7
    i32.store offset=36
    local.get 1
    i32.load offset=4
    local.set 8
    local.get 4
    i32.load offset=72
    local.set 9
    local.get 2
    local.get 5
    i32.load offset=4
    local.tee 10
    i32.const 2
    i32.shl
    i32.const 15
    i32.add
    i32.const -16
    i32.and
    local.tee 4
    i32.sub
    local.tee 11
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    local.get 4
    i32.sub
    local.tee 12
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    local.get 4
    i32.sub
    local.tee 13
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    local.get 4
    i32.sub
    local.tee 14
    global.set $__stack_pointer
    block  ;; label = @1
      local.get 10
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 8
      i32.const 4
      i32.add
      local.set 15
      local.get 7
      i32.const 1
      i32.shl
      i32.const 2147483646
      i32.and
      local.set 16
      i32.const 0
      local.set 4
      i32.const 0
      local.set 2
      loop  ;; label = @2
        local.get 14
        local.get 4
        i32.add
        local.get 0
        local.get 1
        i32.load offset=8
        local.get 15
        local.get 4
        i32.add
        i32.load
        i32.const 2
        i32.shl
        local.tee 10
        i32.add
        i32.load
        local.get 1
        i32.load offset=16
        local.get 10
        i32.add
        i32.load
        i32.load offset=16
        call_indirect (type 5)
        local.tee 10
        i32.store
        local.get 13
        local.get 4
        i32.add
        local.get 10
        i32.const 0
        i32.ne
        i32.store
        local.get 0
        i32.load
        local.get 4
        i32.add
        i32.load
        i32.const 0
        local.get 16
        call $memset
        drop
        local.get 4
        i32.const 4
        i32.add
        local.set 4
        local.get 2
        i32.const 1
        i32.add
        local.tee 2
        local.get 5
        i32.load offset=4
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 8
      i32.load offset=1164
      local.tee 16
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 8
      i32.const 2192
      i32.add
      local.set 4
      local.get 16
      local.set 10
      loop  ;; label = @2
        local.get 4
        i32.load
        local.set 2
        block  ;; label = @3
          block  ;; label = @4
            local.get 13
            local.get 4
            i32.const -1024
            i32.add
            i32.load
            i32.const 2
            i32.shl
            i32.add
            local.tee 15
            i32.load
            br_if 0 (;@4;)
            local.get 13
            local.get 2
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.eqz
            br_if 1 (;@3;)
          end
          local.get 15
          i32.const 1
          i32.store
          local.get 13
          local.get 2
          i32.const 2
          i32.shl
          i32.add
          i32.const 1
          i32.store
        end
        local.get 4
        i32.const 4
        i32.add
        local.set 4
        local.get 10
        i32.const -1
        i32.add
        local.tee 10
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 8
      i32.load
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 8
      i32.const 4
      i32.add
      local.set 16
      i32.const 0
      local.set 15
      loop  ;; label = @2
        i32.const 0
        local.set 10
        block  ;; label = @3
          local.get 5
          i32.load offset=4
          local.tee 2
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 4
          i32.const 0
          local.set 10
          loop  ;; label = @4
            block  ;; label = @5
              local.get 16
              local.get 4
              i32.add
              i32.load
              local.get 15
              i32.ne
              br_if 0 (;@5;)
              local.get 12
              local.get 10
              i32.const 2
              i32.shl
              local.tee 17
              i32.add
              local.get 13
              local.get 4
              i32.add
              i32.load
              i32.const 0
              i32.ne
              i32.store
              local.get 11
              local.get 17
              i32.add
              local.get 0
              i32.load
              local.get 4
              i32.add
              i32.load
              i32.store
              local.get 10
              i32.const 1
              i32.add
              local.set 10
            end
            local.get 4
            i32.const 4
            i32.add
            local.set 4
            local.get 2
            i32.const -1
            i32.add
            local.tee 2
            br_if 0 (;@4;)
          end
        end
        local.get 0
        local.get 1
        i32.load offset=12
        local.get 15
        i32.const 2
        i32.shl
        local.tee 4
        i32.add
        i32.load
        local.get 11
        local.get 12
        local.get 10
        local.get 1
        i32.load offset=20
        local.get 4
        i32.add
        i32.load
        i32.load offset=16
        call_indirect (type 6)
        drop
        local.get 15
        i32.const 1
        i32.add
        local.tee 15
        local.get 8
        i32.load
        i32.lt_s
        br_if 0 (;@2;)
      end
      local.get 8
      i32.load offset=1164
      local.set 16
    end
    block  ;; label = @1
      local.get 16
      i32.const -1
      i32.add
      local.tee 4
      i32.const 0
      i32.lt_s
      br_if 0 (;@1;)
      local.get 7
      i32.const 2
      i32.div_s
      local.set 12
      local.get 0
      i32.load
      local.set 11
      loop  ;; label = @2
        local.get 4
        local.set 17
        block  ;; label = @3
          local.get 7
          i32.const 2
          i32.lt_s
          br_if 0 (;@3;)
          local.get 11
          local.get 8
          local.get 17
          i32.const 2
          i32.shl
          i32.add
          local.tee 2
          i32.const 2192
          i32.add
          i32.load
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.set 4
          local.get 11
          local.get 2
          i32.const 1168
          i32.add
          i32.load
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.set 2
          local.get 12
          local.set 16
          loop  ;; label = @4
            local.get 4
            i32.load
            local.set 10
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                i32.load
                local.tee 15
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                block  ;; label = @7
                  local.get 10
                  i32.const 1
                  i32.lt_s
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 15
                  local.get 10
                  i32.sub
                  i32.store
                  br 2 (;@5;)
                end
                local.get 4
                local.get 15
                i32.store
                local.get 2
                local.get 10
                local.get 15
                i32.add
                i32.store
                br 1 (;@5;)
              end
              block  ;; label = @6
                local.get 10
                i32.const 1
                i32.lt_s
                br_if 0 (;@6;)
                local.get 4
                local.get 10
                local.get 15
                i32.add
                i32.store
                br 1 (;@5;)
              end
              local.get 4
              local.get 15
              i32.store
              local.get 2
              local.get 15
              local.get 10
              i32.sub
              i32.store
            end
            local.get 2
            i32.const 4
            i32.add
            local.set 2
            local.get 4
            i32.const 4
            i32.add
            local.set 4
            local.get 16
            i32.const -1
            i32.add
            local.tee 16
            br_if 0 (;@4;)
          end
        end
        local.get 17
        i32.const -1
        i32.add
        local.set 4
        local.get 17
        i32.const 0
        i32.gt_s
        br_if 0 (;@2;)
      end
    end
    block  ;; label = @1
      local.get 5
      i32.load offset=4
      local.tee 2
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 8
      i32.const 4
      i32.add
      local.set 15
      i32.const 0
      local.set 4
      i32.const 0
      local.set 10
      loop  ;; label = @2
        local.get 0
        local.get 1
        i32.load offset=8
        local.get 15
        local.get 4
        i32.add
        i32.load
        i32.const 2
        i32.shl
        local.tee 2
        i32.add
        i32.load
        local.get 14
        local.get 4
        i32.add
        i32.load
        local.get 0
        i32.load
        local.get 4
        i32.add
        i32.load
        local.get 1
        i32.load offset=16
        local.get 2
        i32.add
        i32.load
        i32.load offset=20
        call_indirect (type 2)
        drop
        local.get 4
        i32.const 4
        i32.add
        local.set 4
        local.get 10
        i32.const 1
        i32.add
        local.tee 10
        local.get 5
        i32.load offset=4
        local.tee 2
        i32.lt_s
        br_if 0 (;@2;)
      end
      local.get 2
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 7
      i32.const 1
      i32.shr_s
      local.tee 18
      i32.const 2
      i32.shl
      local.tee 12
      local.get 7
      i32.const -4
      i32.and
      local.tee 4
      i32.add
      local.tee 19
      i32.const -32
      i32.add
      local.set 20
      local.get 4
      i32.const -16
      i32.add
      local.set 21
      local.get 12
      i32.const -28
      i32.add
      local.set 22
      local.get 7
      i32.const 2
      i32.shr_s
      i32.const 2
      i32.shl
      local.set 23
      i32.const 0
      local.set 24
      loop  ;; label = @2
        local.get 0
        i32.load
        local.get 24
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.set 25
        i32.const 5
        local.set 17
        loop  ;; label = @3
          local.get 7
          local.get 17
          i32.const 1
          i32.add
          local.tee 17
          i32.shr_u
          i32.const 1
          i32.and
          i32.eqz
          br_if 0 (;@3;)
        end
        local.get 25
        local.get 12
        i32.add
        local.tee 26
        local.get 23
        i32.add
        local.set 27
        local.get 25
        local.get 20
        i32.add
        local.set 11
        local.get 25
        local.get 23
        i32.add
        local.set 28
        i32.const 2
        i32.const 13
        local.get 17
        i32.sub
        local.tee 29
        i32.shl
        local.set 30
        i32.const 16777232
        local.set 4
        local.get 22
        local.set 15
        local.get 19
        local.set 16
        loop  ;; label = @3
          local.get 25
          local.get 16
          i32.add
          local.tee 2
          i32.const -4
          i32.add
          local.get 25
          local.get 15
          i32.add
          local.tee 10
          i32.const 24
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 1
          local.get 4
          i32.load8_u
          local.tee 14
          i32.mul
          local.get 10
          i32.const 16
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 8
          local.get 4
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 31
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const -8
          i32.add
          local.get 1
          local.get 31
          i32.mul
          local.get 8
          local.get 14
          i32.mul
          i32.add
          i32.store
          local.get 2
          i32.const -12
          i32.add
          local.get 10
          i32.const 8
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 1
          local.get 4
          local.get 30
          i32.add
          local.tee 4
          i32.load8_u
          local.tee 14
          i32.mul
          local.get 10
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 10
          local.get 4
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 8
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const -16
          i32.add
          local.get 1
          local.get 8
          i32.mul
          local.get 10
          local.get 14
          i32.mul
          i32.add
          i32.store
          local.get 11
          local.tee 2
          i32.const -16
          i32.add
          local.set 11
          local.get 16
          i32.const -16
          i32.add
          local.set 16
          local.get 4
          local.get 30
          i32.add
          local.set 4
          local.get 25
          local.get 15
          i32.const -32
          i32.add
          local.tee 15
          i32.add
          local.tee 10
          local.get 28
          i32.ge_u
          br_if 0 (;@3;)
        end
        i32.const 0
        local.get 30
        i32.sub
        local.set 32
        loop  ;; label = @3
          local.get 2
          i32.const 12
          i32.add
          local.get 10
          i32.const 24
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 15
          local.get 4
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 16
          i32.mul
          local.get 10
          i32.const 16
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 11
          local.get 4
          i32.load8_u
          local.tee 1
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const 8
          i32.add
          local.get 15
          local.get 1
          i32.mul
          local.get 11
          local.get 16
          i32.mul
          i32.add
          i32.store
          local.get 2
          i32.const 4
          i32.add
          local.get 10
          i32.const 8
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 15
          local.get 4
          local.get 32
          i32.add
          local.tee 4
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 16
          i32.mul
          local.get 10
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 11
          local.get 4
          i32.load8_u
          local.tee 1
          i32.mul
          i32.sub
          i32.store
          local.get 2
          local.get 15
          local.get 1
          i32.mul
          local.get 11
          local.get 16
          i32.mul
          i32.add
          i32.store
          local.get 2
          i32.const -16
          i32.add
          local.set 2
          local.get 4
          local.get 32
          i32.add
          local.set 4
          local.get 10
          i32.const -32
          i32.add
          local.tee 10
          local.get 25
          i32.ge_u
          br_if 0 (;@3;)
        end
        local.get 30
        i32.const 1
        i32.shl
        local.set 8
        local.get 26
        i32.const -32
        i32.add
        local.set 4
        i32.const 16777232
        local.set 10
        local.get 27
        local.set 2
        loop  ;; label = @3
          local.get 2
          i32.const 4
          i32.add
          local.get 4
          i32.const 24
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 16
          local.get 10
          local.get 30
          i32.add
          local.tee 15
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 11
          i32.mul
          local.get 4
          i32.const 16
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 1
          local.get 15
          i32.load8_u
          local.tee 14
          i32.mul
          i32.add
          i32.store
          local.get 2
          local.get 16
          local.get 14
          i32.mul
          local.get 1
          local.get 11
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const 12
          i32.add
          local.get 4
          i32.const 8
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 16
          local.get 10
          local.get 8
          i32.add
          local.tee 10
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 11
          i32.mul
          local.get 4
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 1
          local.get 10
          i32.load8_u
          local.tee 10
          i32.mul
          i32.add
          i32.store
          local.get 2
          i32.const 8
          i32.add
          local.get 16
          local.get 10
          i32.mul
          local.get 1
          local.get 11
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const 16
          i32.add
          local.set 2
          local.get 15
          local.get 30
          i32.add
          local.set 10
          local.get 4
          i32.const -32
          i32.add
          local.tee 4
          local.get 28
          i32.ge_u
          br_if 0 (;@3;)
        end
        i32.const 0
        local.get 8
        i32.sub
        local.set 33
        loop  ;; label = @3
          local.get 2
          i32.const 4
          i32.add
          local.get 4
          i32.const 24
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 16
          local.get 10
          local.get 32
          i32.add
          local.tee 15
          i32.load8_u
          local.tee 11
          i32.mul
          local.get 4
          i32.const 16
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 1
          local.get 15
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 14
          i32.mul
          i32.add
          i32.store
          local.get 2
          local.get 16
          local.get 14
          i32.mul
          local.get 1
          local.get 11
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const 12
          i32.add
          local.get 4
          i32.const 8
          i32.add
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 16
          local.get 10
          local.get 33
          i32.add
          local.tee 10
          i32.load8_u
          local.tee 11
          i32.mul
          local.get 4
          i32.load
          i32.const 8
          i32.shr_s
          local.tee 1
          local.get 10
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 10
          i32.mul
          i32.add
          i32.store
          local.get 2
          i32.const 8
          i32.add
          local.get 16
          local.get 10
          i32.mul
          local.get 1
          local.get 11
          i32.mul
          i32.sub
          i32.store
          local.get 2
          i32.const 16
          i32.add
          local.set 2
          local.get 15
          local.get 32
          i32.add
          local.set 10
          local.get 4
          i32.const -32
          i32.add
          local.tee 4
          local.get 25
          i32.ge_u
          br_if 0 (;@3;)
        end
        block  ;; label = @3
          local.get 17
          i32.const -6
          i32.add
          local.tee 34
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          local.get 25
          i32.const -32
          i32.add
          local.set 35
          i32.const 0
          local.set 36
          loop  ;; label = @4
            block  ;; label = @5
              local.get 36
              i32.const 31
              i32.eq
              br_if 0 (;@5;)
              i32.const 1
              local.get 36
              i32.shl
              local.set 37
              local.get 35
              local.get 18
              local.get 36
              i32.shr_s
              local.tee 4
              i32.const 2
              i32.shl
              local.tee 38
              i32.add
              local.set 39
              i32.const 0
              local.set 40
              i32.const 0
              i32.const 4
              local.get 36
              local.get 29
              i32.add
              i32.shl
              local.tee 15
              i32.sub
              local.set 16
              local.get 35
              local.get 4
              i32.const 1
              i32.shl
              i32.const -4
              i32.and
              i32.add
              local.set 41
              loop  ;; label = @6
                i32.const 16777232
                local.set 10
                local.get 41
                local.set 17
                local.get 39
                local.set 11
                loop  ;; label = @7
                  local.get 11
                  local.get 12
                  i32.add
                  local.tee 4
                  i32.const 24
                  i32.add
                  local.tee 1
                  local.get 17
                  local.get 12
                  i32.add
                  local.tee 2
                  i32.const 24
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 8
                  local.get 1
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 28
                  i32.add
                  local.tee 31
                  local.get 31
                  i32.load
                  local.tee 31
                  local.get 2
                  i32.const 28
                  i32.add
                  local.tee 42
                  i32.load
                  local.tee 43
                  i32.add
                  i32.store
                  local.get 42
                  local.get 1
                  local.get 8
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 10
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  local.get 43
                  local.get 31
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 31
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 43
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 14
                  local.get 1
                  local.get 43
                  i32.mul
                  local.get 31
                  local.get 8
                  i32.mul
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 16
                  i32.add
                  local.tee 1
                  local.get 2
                  i32.const 16
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 8
                  local.get 1
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 20
                  i32.add
                  local.tee 31
                  local.get 31
                  i32.load
                  local.tee 31
                  local.get 2
                  i32.const 20
                  i32.add
                  local.tee 42
                  i32.load
                  local.tee 43
                  i32.add
                  i32.store
                  local.get 42
                  local.get 1
                  local.get 8
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  local.get 43
                  local.get 31
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 31
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 43
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 14
                  local.get 1
                  local.get 43
                  i32.mul
                  local.get 31
                  local.get 8
                  i32.mul
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 8
                  i32.add
                  local.tee 1
                  local.get 2
                  i32.const 8
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 8
                  local.get 1
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 12
                  i32.add
                  local.tee 31
                  local.get 31
                  i32.load
                  local.tee 31
                  local.get 2
                  i32.const 12
                  i32.add
                  local.tee 42
                  i32.load
                  local.tee 43
                  i32.add
                  i32.store
                  local.get 42
                  local.get 1
                  local.get 8
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  local.get 43
                  local.get 31
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 31
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 43
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 14
                  local.get 1
                  local.get 43
                  i32.mul
                  local.get 31
                  local.get 8
                  i32.mul
                  i32.add
                  i32.store
                  local.get 4
                  local.get 2
                  i32.load
                  local.tee 1
                  local.get 4
                  i32.load
                  local.tee 14
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 4
                  i32.add
                  local.tee 4
                  local.get 4
                  i32.load
                  local.tee 8
                  local.get 2
                  i32.const 4
                  i32.add
                  local.tee 31
                  i32.load
                  local.tee 42
                  i32.add
                  i32.store
                  local.get 31
                  local.get 14
                  local.get 1
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 4
                  i32.load8_u
                  local.tee 10
                  i32.mul
                  local.get 42
                  local.get 8
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 4
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 2
                  local.get 1
                  local.get 8
                  i32.mul
                  local.get 14
                  local.get 10
                  i32.mul
                  i32.add
                  i32.store
                  local.get 17
                  i32.const -32
                  i32.add
                  local.set 17
                  local.get 11
                  i32.const -32
                  i32.add
                  local.set 11
                  local.get 4
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.const 16778256
                  i32.lt_u
                  br_if 0 (;@7;)
                end
                local.get 11
                local.get 12
                i32.add
                local.set 43
                local.get 17
                local.get 12
                i32.add
                local.set 44
                i32.const 0
                local.set 17
                loop  ;; label = @7
                  local.get 43
                  local.get 17
                  i32.add
                  local.tee 4
                  i32.const 24
                  i32.add
                  local.tee 11
                  local.get 44
                  local.get 17
                  i32.add
                  local.tee 2
                  i32.const 24
                  i32.add
                  local.tee 1
                  i32.load
                  local.tee 14
                  local.get 11
                  i32.load
                  local.tee 11
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 28
                  i32.add
                  local.tee 8
                  local.get 2
                  i32.const 28
                  i32.add
                  local.tee 31
                  i32.load
                  local.tee 42
                  local.get 8
                  i32.load
                  local.tee 8
                  i32.add
                  i32.store
                  local.get 31
                  local.get 11
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 11
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 14
                  i32.mul
                  local.get 8
                  local.get 42
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 8
                  local.get 10
                  i32.load8_u
                  local.tee 42
                  i32.mul
                  i32.add
                  i32.store
                  local.get 1
                  local.get 11
                  local.get 42
                  i32.mul
                  local.get 8
                  local.get 14
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 4
                  i32.const 16
                  i32.add
                  local.tee 11
                  local.get 2
                  i32.const 16
                  i32.add
                  local.tee 1
                  i32.load
                  local.tee 14
                  local.get 11
                  i32.load
                  local.tee 11
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 20
                  i32.add
                  local.tee 8
                  local.get 2
                  i32.const 20
                  i32.add
                  local.tee 31
                  i32.load
                  local.tee 42
                  local.get 8
                  i32.load
                  local.tee 8
                  i32.add
                  i32.store
                  local.get 31
                  local.get 11
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 11
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 14
                  i32.mul
                  local.get 8
                  local.get 42
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 8
                  local.get 10
                  i32.load8_u
                  local.tee 42
                  i32.mul
                  i32.add
                  i32.store
                  local.get 1
                  local.get 11
                  local.get 42
                  i32.mul
                  local.get 8
                  local.get 14
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 4
                  i32.const 8
                  i32.add
                  local.tee 11
                  local.get 2
                  i32.const 8
                  i32.add
                  local.tee 1
                  i32.load
                  local.tee 14
                  local.get 11
                  i32.load
                  local.tee 11
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 12
                  i32.add
                  local.tee 8
                  local.get 2
                  i32.const 12
                  i32.add
                  local.tee 31
                  i32.load
                  local.tee 42
                  local.get 8
                  i32.load
                  local.tee 8
                  i32.add
                  i32.store
                  local.get 31
                  local.get 11
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 11
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 14
                  i32.mul
                  local.get 8
                  local.get 42
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 8
                  local.get 10
                  i32.load8_u
                  local.tee 42
                  i32.mul
                  i32.add
                  i32.store
                  local.get 1
                  local.get 11
                  local.get 42
                  i32.mul
                  local.get 8
                  local.get 14
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 4
                  local.get 2
                  i32.load
                  local.tee 11
                  local.get 4
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 4
                  i32.const 4
                  i32.add
                  local.tee 4
                  local.get 2
                  i32.const 4
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 8
                  local.get 4
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 14
                  local.get 1
                  local.get 11
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 11
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 4
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 10
                  i32.mul
                  local.get 31
                  local.get 8
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 4
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  i32.add
                  i32.store
                  local.get 2
                  local.get 11
                  local.get 8
                  i32.mul
                  local.get 1
                  local.get 10
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 17
                  i32.const -32
                  i32.add
                  local.set 17
                  local.get 4
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 16777232
                  i32.gt_u
                  br_if 0 (;@7;)
                end
                local.get 44
                local.get 17
                i32.add
                local.set 4
                local.get 43
                local.get 17
                i32.add
                local.set 2
                loop  ;; label = @7
                  local.get 2
                  i32.const 24
                  i32.add
                  local.tee 17
                  local.get 17
                  i32.load
                  local.tee 17
                  local.get 4
                  i32.const 24
                  i32.add
                  local.tee 11
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 28
                  i32.add
                  local.tee 14
                  local.get 14
                  i32.load
                  local.tee 14
                  local.get 4
                  i32.const 28
                  i32.add
                  local.tee 8
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 8
                  local.get 31
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 10
                  i32.load8_u
                  local.tee 31
                  i32.mul
                  local.get 1
                  local.get 17
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 1
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 11
                  local.get 14
                  local.get 1
                  i32.mul
                  local.get 17
                  local.get 31
                  i32.mul
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 16
                  i32.add
                  local.tee 17
                  local.get 17
                  i32.load
                  local.tee 17
                  local.get 4
                  i32.const 16
                  i32.add
                  local.tee 11
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 20
                  i32.add
                  local.tee 14
                  local.get 14
                  i32.load
                  local.tee 14
                  local.get 4
                  i32.const 20
                  i32.add
                  local.tee 8
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 8
                  local.get 31
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.load8_u
                  local.tee 31
                  i32.mul
                  local.get 1
                  local.get 17
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 1
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 11
                  local.get 14
                  local.get 1
                  i32.mul
                  local.get 17
                  local.get 31
                  i32.mul
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 8
                  i32.add
                  local.tee 17
                  local.get 17
                  i32.load
                  local.tee 17
                  local.get 4
                  i32.const 8
                  i32.add
                  local.tee 11
                  i32.load
                  local.tee 1
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 12
                  i32.add
                  local.tee 14
                  local.get 14
                  i32.load
                  local.tee 14
                  local.get 4
                  i32.const 12
                  i32.add
                  local.tee 8
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 8
                  local.get 31
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.load8_u
                  local.tee 31
                  i32.mul
                  local.get 1
                  local.get 17
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 1
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 11
                  local.get 14
                  local.get 1
                  i32.mul
                  local.get 17
                  local.get 31
                  i32.mul
                  i32.add
                  i32.store
                  local.get 2
                  local.get 2
                  i32.load
                  local.tee 17
                  local.get 4
                  i32.load
                  local.tee 11
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 4
                  i32.add
                  local.tee 1
                  local.get 1
                  i32.load
                  local.tee 1
                  local.get 4
                  i32.const 4
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 8
                  i32.add
                  i32.store
                  local.get 14
                  local.get 8
                  local.get 1
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  local.get 11
                  local.get 17
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 11
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 4
                  local.get 1
                  local.get 11
                  i32.mul
                  local.get 17
                  local.get 8
                  i32.mul
                  i32.add
                  i32.store
                  local.get 4
                  i32.const -32
                  i32.add
                  local.set 4
                  local.get 2
                  i32.const -32
                  i32.add
                  local.set 2
                  local.get 10
                  local.get 15
                  i32.add
                  local.tee 10
                  i32.const 16778256
                  i32.lt_u
                  br_if 0 (;@7;)
                end
                loop  ;; label = @7
                  local.get 2
                  i32.const 24
                  i32.add
                  local.tee 17
                  local.get 4
                  i32.const 24
                  i32.add
                  local.tee 11
                  i32.load
                  local.tee 1
                  local.get 17
                  i32.load
                  local.tee 17
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 28
                  i32.add
                  local.tee 14
                  local.get 14
                  i32.load
                  local.tee 14
                  local.get 4
                  i32.const 28
                  i32.add
                  local.tee 8
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 8
                  local.get 31
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 31
                  i32.mul
                  local.get 17
                  local.get 1
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.load8_u
                  local.tee 1
                  i32.mul
                  i32.add
                  i32.store
                  local.get 11
                  local.get 14
                  local.get 1
                  i32.mul
                  local.get 17
                  local.get 31
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 2
                  i32.const 16
                  i32.add
                  local.tee 17
                  local.get 4
                  i32.const 16
                  i32.add
                  local.tee 11
                  i32.load
                  local.tee 1
                  local.get 17
                  i32.load
                  local.tee 17
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 20
                  i32.add
                  local.tee 14
                  local.get 14
                  i32.load
                  local.tee 14
                  local.get 4
                  i32.const 20
                  i32.add
                  local.tee 8
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 8
                  local.get 31
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 31
                  i32.mul
                  local.get 17
                  local.get 1
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.load8_u
                  local.tee 1
                  i32.mul
                  i32.add
                  i32.store
                  local.get 11
                  local.get 14
                  local.get 1
                  i32.mul
                  local.get 17
                  local.get 31
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 2
                  i32.const 8
                  i32.add
                  local.tee 17
                  local.get 4
                  i32.const 8
                  i32.add
                  local.tee 11
                  i32.load
                  local.tee 1
                  local.get 17
                  i32.load
                  local.tee 17
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 12
                  i32.add
                  local.tee 14
                  local.get 14
                  i32.load
                  local.tee 14
                  local.get 4
                  i32.const 12
                  i32.add
                  local.tee 8
                  i32.load
                  local.tee 31
                  i32.add
                  i32.store
                  local.get 8
                  local.get 31
                  local.get 14
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 14
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 31
                  i32.mul
                  local.get 17
                  local.get 1
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.load8_u
                  local.tee 1
                  i32.mul
                  i32.add
                  i32.store
                  local.get 11
                  local.get 14
                  local.get 1
                  i32.mul
                  local.get 17
                  local.get 31
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 2
                  local.get 4
                  i32.load
                  local.tee 17
                  local.get 2
                  i32.load
                  local.tee 11
                  i32.add
                  i32.store
                  local.get 2
                  i32.const 4
                  i32.add
                  local.tee 1
                  local.get 1
                  i32.load
                  local.tee 1
                  local.get 4
                  i32.const 4
                  i32.add
                  local.tee 14
                  i32.load
                  local.tee 8
                  i32.add
                  i32.store
                  local.get 14
                  local.get 8
                  local.get 1
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 1
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 1
                  i32.add
                  i32.load8_u
                  local.tee 8
                  i32.mul
                  local.get 11
                  local.get 17
                  i32.sub
                  i32.const 8
                  i32.shr_s
                  local.tee 17
                  local.get 10
                  i32.load8_u
                  local.tee 11
                  i32.mul
                  i32.add
                  i32.store
                  local.get 4
                  local.get 1
                  local.get 11
                  i32.mul
                  local.get 17
                  local.get 8
                  i32.mul
                  i32.sub
                  i32.store
                  local.get 4
                  i32.const -32
                  i32.add
                  local.set 4
                  local.get 2
                  i32.const -32
                  i32.add
                  local.set 2
                  local.get 10
                  local.get 16
                  i32.add
                  local.tee 10
                  i32.const 16777232
                  i32.gt_u
                  br_if 0 (;@7;)
                end
                local.get 41
                local.get 38
                i32.add
                local.set 41
                local.get 39
                local.get 38
                i32.add
                local.set 39
                local.get 40
                i32.const 1
                i32.add
                local.tee 40
                local.get 37
                i32.ne
                br_if 0 (;@6;)
              end
            end
            local.get 36
            i32.const 1
            i32.add
            local.tee 36
            local.get 34
            i32.ne
            br_if 0 (;@4;)
          end
        end
        block  ;; label = @3
          local.get 18
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 40
          local.get 26
          local.set 4
          loop  ;; label = @4
            local.get 4
            i32.const 64
            i32.add
            local.tee 37
            i32.load
            local.set 2
            local.get 4
            i32.const 32
            i32.add
            local.tee 36
            i32.load
            local.set 10
            local.get 4
            i32.const 96
            i32.add
            local.tee 34
            i32.load
            local.set 15
            local.get 4
            i32.const 80
            i32.add
            local.tee 35
            i32.load
            local.set 16
            local.get 4
            i32.const 16
            i32.add
            local.tee 45
            i32.load
            local.set 17
            local.get 4
            i32.const 48
            i32.add
            local.tee 46
            i32.load
            local.set 11
            local.get 4
            i32.const 112
            i32.add
            local.tee 47
            i32.load
            local.set 1
            local.get 4
            i32.const 72
            i32.add
            local.tee 48
            i32.load
            local.set 14
            local.get 4
            i32.const 8
            i32.add
            local.tee 49
            i32.load
            local.set 8
            local.get 4
            i32.const 40
            i32.add
            local.tee 50
            i32.load
            local.set 31
            local.get 4
            i32.const 104
            i32.add
            local.tee 51
            i32.load
            local.set 42
            local.get 4
            i32.const 24
            i32.add
            local.tee 52
            i32.load
            local.set 43
            local.get 4
            i32.const 88
            i32.add
            local.tee 53
            i32.load
            local.set 44
            local.get 4
            i32.const 56
            i32.add
            local.tee 54
            i32.load
            local.set 39
            local.get 4
            i32.const 120
            i32.add
            local.tee 55
            i32.load
            local.set 41
            local.get 4
            i32.load
            local.set 38
            local.get 4
            i32.const 124
            i32.add
            local.tee 56
            local.get 4
            i32.const 68
            i32.add
            local.tee 57
            i32.load
            local.tee 58
            local.get 4
            i32.const 4
            i32.add
            local.tee 59
            i32.load
            local.tee 60
            i32.add
            local.tee 61
            local.get 4
            i32.const 36
            i32.add
            local.tee 62
            i32.load
            local.tee 63
            local.get 4
            i32.const 100
            i32.add
            local.tee 64
            i32.load
            local.tee 65
            i32.add
            local.tee 66
            i32.add
            local.tee 67
            local.get 4
            i32.const 84
            i32.add
            local.tee 68
            i32.load
            local.tee 69
            local.get 4
            i32.const 20
            i32.add
            local.tee 70
            i32.load
            local.tee 71
            i32.add
            local.tee 72
            local.get 4
            i32.const 52
            i32.add
            local.tee 73
            i32.load
            local.tee 74
            local.get 4
            i32.const 116
            i32.add
            local.tee 75
            i32.load
            local.tee 76
            i32.add
            local.tee 77
            i32.add
            local.tee 78
            i32.add
            local.tee 79
            local.get 4
            i32.const 76
            i32.add
            local.tee 80
            i32.load
            local.tee 81
            local.get 4
            i32.const 12
            i32.add
            local.tee 82
            i32.load
            local.tee 83
            i32.add
            local.tee 84
            local.get 4
            i32.const 44
            i32.add
            local.tee 85
            i32.load
            local.tee 86
            local.get 4
            i32.const 108
            i32.add
            local.tee 87
            i32.load
            local.tee 88
            i32.add
            local.tee 89
            i32.add
            local.tee 90
            local.get 4
            i32.const 92
            i32.add
            local.tee 91
            i32.load
            local.tee 92
            local.get 4
            i32.const 28
            i32.add
            local.tee 93
            i32.load
            local.tee 94
            i32.add
            local.tee 95
            local.get 4
            i32.const 60
            i32.add
            local.tee 96
            i32.load
            local.tee 97
            local.get 56
            i32.load
            local.tee 56
            i32.add
            local.tee 98
            i32.add
            local.tee 99
            i32.add
            local.tee 100
            i32.add
            i32.store
            local.get 55
            local.get 2
            local.get 38
            i32.add
            local.tee 101
            local.get 10
            local.get 15
            i32.add
            local.tee 102
            i32.add
            local.tee 103
            local.get 16
            local.get 17
            i32.add
            local.tee 104
            local.get 11
            local.get 1
            i32.add
            local.tee 105
            i32.add
            local.tee 106
            i32.add
            local.tee 107
            local.get 14
            local.get 8
            i32.add
            local.tee 108
            local.get 31
            local.get 42
            i32.add
            local.tee 109
            i32.add
            local.tee 110
            local.get 43
            local.get 44
            i32.add
            local.tee 111
            local.get 39
            local.get 41
            i32.add
            local.tee 112
            i32.add
            local.tee 113
            i32.add
            local.tee 114
            i32.add
            i32.store
            local.get 75
            local.get 100
            local.get 79
            i32.sub
            i32.store
            local.get 47
            local.get 114
            local.get 107
            i32.sub
            i32.store
            local.get 87
            local.get 106
            local.get 103
            i32.sub
            local.tee 47
            local.get 99
            local.get 90
            i32.sub
            local.tee 55
            i32.add
            i32.store
            local.get 51
            local.get 113
            local.get 110
            i32.sub
            local.tee 75
            local.get 78
            local.get 67
            i32.sub
            local.tee 67
            i32.sub
            i32.store
            local.get 64
            local.get 55
            local.get 47
            i32.sub
            i32.store
            local.get 34
            local.get 67
            local.get 75
            i32.add
            i32.store
            local.get 91
            local.get 61
            local.get 66
            i32.sub
            local.tee 34
            local.get 101
            local.get 102
            i32.sub
            local.tee 47
            i32.sub
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 51
            local.get 77
            local.get 72
            i32.sub
            local.tee 55
            local.get 105
            local.get 104
            i32.sub
            local.tee 61
            i32.add
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 64
            i32.add
            local.tee 66
            local.get 109
            local.get 108
            i32.sub
            local.tee 67
            local.get 98
            local.get 95
            i32.sub
            local.tee 72
            i32.add
            local.tee 75
            i32.add
            i32.store
            local.get 53
            local.get 34
            local.get 47
            i32.add
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 34
            local.get 61
            local.get 55
            i32.sub
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 47
            i32.add
            local.tee 55
            local.get 84
            local.get 89
            i32.sub
            local.tee 61
            local.get 112
            local.get 111
            i32.sub
            local.tee 77
            i32.add
            local.tee 78
            i32.add
            i32.store
            local.get 68
            local.get 75
            local.get 66
            i32.sub
            i32.store
            local.get 35
            local.get 78
            local.get 55
            i32.sub
            i32.store
            local.get 80
            local.get 47
            local.get 34
            i32.sub
            local.tee 34
            local.get 72
            local.get 67
            i32.sub
            local.tee 35
            i32.add
            i32.store
            local.get 48
            local.get 77
            local.get 61
            i32.sub
            local.tee 47
            local.get 64
            local.get 51
            i32.sub
            local.tee 51
            i32.sub
            i32.store
            local.get 57
            local.get 35
            local.get 34
            i32.sub
            i32.store
            local.get 37
            local.get 51
            local.get 47
            i32.add
            i32.store
            local.get 96
            local.get 60
            local.get 58
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 37
            i32.const 237
            i32.mul
            local.get 38
            local.get 2
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 2
            i32.const -98
            i32.mul
            i32.add
            local.tee 38
            local.get 65
            local.get 63
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 34
            i32.const 98
            i32.mul
            local.get 15
            local.get 10
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 10
            i32.const 237
            i32.mul
            i32.add
            local.tee 15
            i32.add
            local.tee 35
            local.get 71
            local.get 69
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 47
            i32.const 98
            i32.mul
            local.get 17
            local.get 16
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 16
            i32.const -237
            i32.mul
            i32.add
            local.tee 17
            local.get 76
            local.get 74
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 48
            i32.const 237
            i32.mul
            local.get 1
            local.get 11
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 11
            i32.const 98
            i32.mul
            i32.add
            local.tee 1
            i32.add
            local.tee 51
            i32.add
            local.tee 53
            local.get 83
            local.get 81
            i32.sub
            local.tee 55
            local.get 8
            local.get 14
            i32.sub
            local.tee 14
            i32.sub
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 8
            local.get 88
            local.get 86
            i32.sub
            local.tee 57
            local.get 42
            local.get 31
            i32.sub
            local.tee 31
            i32.add
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 42
            i32.add
            local.tee 58
            local.get 44
            local.get 43
            i32.sub
            local.tee 43
            local.get 56
            local.get 97
            i32.sub
            local.tee 44
            i32.add
            local.tee 56
            i32.add
            local.tee 60
            i32.add
            i32.store
            local.get 54
            local.get 37
            i32.const 98
            i32.mul
            local.get 2
            i32.const 237
            i32.mul
            i32.add
            local.tee 2
            local.get 34
            i32.const -237
            i32.mul
            local.get 10
            i32.const 98
            i32.mul
            i32.add
            local.tee 10
            i32.add
            local.tee 37
            local.get 47
            i32.const 237
            i32.mul
            local.get 16
            i32.const 98
            i32.mul
            i32.add
            local.tee 16
            local.get 48
            i32.const -98
            i32.mul
            local.get 11
            i32.const 237
            i32.mul
            i32.add
            local.tee 11
            i32.add
            local.tee 34
            i32.add
            local.tee 47
            local.get 55
            local.get 14
            i32.add
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 14
            local.get 31
            local.get 57
            i32.sub
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 31
            i32.add
            local.tee 48
            local.get 94
            local.get 92
            i32.sub
            local.tee 55
            local.get 41
            local.get 39
            i32.sub
            local.tee 39
            i32.add
            local.tee 41
            i32.add
            local.tee 57
            i32.add
            i32.store
            local.get 73
            local.get 60
            local.get 53
            i32.sub
            i32.store
            local.get 46
            local.get 57
            local.get 47
            i32.sub
            i32.store
            local.get 85
            local.get 34
            local.get 37
            i32.sub
            local.tee 37
            local.get 56
            local.get 58
            i32.sub
            local.tee 34
            i32.add
            i32.store
            local.get 50
            local.get 41
            local.get 48
            i32.sub
            local.tee 41
            local.get 51
            local.get 35
            i32.sub
            local.tee 35
            i32.sub
            i32.store
            local.get 62
            local.get 34
            local.get 37
            i32.sub
            i32.store
            local.get 36
            local.get 35
            local.get 41
            i32.add
            i32.store
            local.get 93
            local.get 38
            local.get 15
            i32.sub
            local.tee 15
            local.get 2
            local.get 10
            i32.sub
            local.tee 2
            i32.sub
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 10
            local.get 1
            local.get 17
            i32.sub
            local.tee 17
            local.get 11
            local.get 16
            i32.sub
            local.tee 16
            i32.add
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 11
            i32.add
            local.tee 1
            local.get 31
            local.get 14
            i32.sub
            local.tee 14
            local.get 44
            local.get 43
            i32.sub
            local.tee 31
            i32.add
            local.tee 43
            i32.add
            i32.store
            local.get 52
            local.get 15
            local.get 2
            i32.add
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 2
            local.get 16
            local.get 17
            i32.sub
            i32.const 8
            i32.shr_s
            i32.const 181
            i32.mul
            local.tee 15
            i32.add
            local.tee 16
            local.get 8
            local.get 42
            i32.sub
            local.tee 17
            local.get 39
            local.get 55
            i32.sub
            local.tee 8
            i32.add
            local.tee 42
            i32.add
            i32.store
            local.get 70
            local.get 43
            local.get 1
            i32.sub
            i32.store
            local.get 45
            local.get 42
            local.get 16
            i32.sub
            i32.store
            local.get 82
            local.get 15
            local.get 2
            i32.sub
            local.tee 2
            local.get 31
            local.get 14
            i32.sub
            local.tee 15
            i32.add
            i32.store
            local.get 49
            local.get 8
            local.get 17
            i32.sub
            local.tee 16
            local.get 11
            local.get 10
            i32.sub
            local.tee 10
            i32.sub
            i32.store
            local.get 59
            local.get 15
            local.get 2
            i32.sub
            i32.store
            local.get 4
            local.get 10
            local.get 16
            i32.add
            i32.store
            local.get 4
            i32.const 128
            i32.add
            local.set 4
            local.get 40
            i32.const 32
            i32.add
            local.tee 40
            local.get 18
            i32.lt_s
            br_if 0 (;@4;)
          end
        end
        local.get 30
        i32.const 1
        i32.shr_u
        i32.const 16777232
        i32.add
        i32.const 16778272
        local.get 30
        i32.const 3
        i32.gt_s
        select
        local.tee 15
        i32.const 1024
        i32.add
        local.set 41
        i32.const 0
        local.set 10
        local.get 26
        local.set 2
        local.get 25
        local.set 4
        loop  ;; label = @3
          local.get 4
          i32.const 4
          i32.add
          local.get 26
          local.get 10
          i32.const 4
          i32.shr_u
          i32.const 15
          i32.and
          i32.const 16779296
          i32.add
          i32.load8_u
          i32.const 4
          i32.shl
          local.get 10
          i32.const 8
          i32.shr_s
          i32.const 16779296
          i32.add
          i32.load8_u
          i32.or
          local.tee 16
          local.get 10
          i32.const 14
          i32.and
          local.tee 17
          i32.const 16779296
          i32.add
          i32.load8_u
          i32.const 8
          i32.shl
          i32.or
          local.tee 11
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 1
          i32.const 4
          i32.add
          i32.load
          local.tee 14
          local.get 26
          local.get 11
          i32.const 4095
          i32.xor
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 11
          i32.load
          local.tee 8
          i32.sub
          i32.const 9
          i32.shr_s
          local.tee 31
          local.get 15
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 42
          i32.mul
          local.get 1
          i32.load
          local.tee 1
          local.get 11
          i32.const -4
          i32.add
          i32.load
          local.tee 11
          i32.add
          i32.const 9
          i32.shr_s
          local.tee 43
          local.get 15
          i32.load8_u
          local.tee 44
          i32.mul
          i32.sub
          local.tee 39
          local.get 11
          local.get 1
          i32.sub
          i32.const 1
          i32.shr_s
          local.tee 11
          i32.add
          i32.store
          local.get 4
          local.get 31
          local.get 44
          i32.mul
          local.get 43
          local.get 42
          i32.mul
          i32.add
          local.tee 1
          local.get 8
          local.get 14
          i32.add
          i32.const 1
          i32.shr_s
          local.tee 14
          i32.add
          i32.store
          local.get 2
          i32.const -4
          i32.add
          local.get 39
          local.get 11
          i32.sub
          i32.store
          local.get 2
          i32.const -8
          i32.add
          local.get 14
          local.get 1
          i32.sub
          i32.store
          local.get 4
          i32.const 12
          i32.add
          local.get 26
          local.get 17
          i32.const 16779297
          i32.add
          i32.load8_u
          i32.const 8
          i32.shl
          local.get 16
          i32.or
          local.tee 16
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 17
          i32.const 4
          i32.add
          i32.load
          local.tee 11
          local.get 26
          local.get 16
          i32.const 4095
          i32.xor
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 16
          i32.load
          local.tee 1
          i32.sub
          i32.const 9
          i32.shr_s
          local.tee 14
          local.get 15
          local.get 30
          i32.add
          local.tee 15
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 8
          i32.mul
          local.get 17
          i32.load
          local.tee 17
          local.get 16
          i32.const -4
          i32.add
          i32.load
          local.tee 16
          i32.add
          i32.const 9
          i32.shr_s
          local.tee 31
          local.get 15
          i32.load8_u
          local.tee 42
          i32.mul
          i32.sub
          local.tee 43
          local.get 16
          local.get 17
          i32.sub
          i32.const 1
          i32.shr_s
          local.tee 16
          i32.add
          i32.store
          local.get 4
          i32.const 8
          i32.add
          local.get 14
          local.get 42
          i32.mul
          local.get 31
          local.get 8
          i32.mul
          i32.add
          local.tee 17
          local.get 1
          local.get 11
          i32.add
          i32.const 1
          i32.shr_s
          local.tee 11
          i32.add
          i32.store
          local.get 2
          i32.const -12
          i32.add
          local.get 43
          local.get 16
          i32.sub
          i32.store
          local.get 2
          i32.const -16
          i32.add
          local.tee 2
          local.get 11
          local.get 17
          i32.sub
          i32.store
          local.get 4
          i32.const 16
          i32.add
          local.set 4
          local.get 10
          i32.const 2
          i32.add
          local.set 10
          local.get 15
          local.get 30
          i32.add
          local.tee 15
          local.get 41
          i32.lt_u
          br_if 0 (;@3;)
        end
        loop  ;; label = @3
          local.get 4
          i32.const 4
          i32.add
          local.get 26
          local.get 10
          i32.const 4
          i32.shr_u
          i32.const 15
          i32.and
          i32.const 16779296
          i32.add
          i32.load8_u
          i32.const 4
          i32.shl
          local.get 10
          i32.const 8
          i32.shr_s
          i32.const 16779296
          i32.add
          i32.load8_u
          i32.or
          local.tee 17
          local.get 10
          i32.const 14
          i32.and
          local.tee 11
          i32.const 16779296
          i32.add
          i32.load8_u
          i32.const 8
          i32.shl
          i32.or
          local.tee 16
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 1
          i32.const 4
          i32.add
          i32.load
          local.tee 14
          local.get 26
          local.get 16
          i32.const 4095
          i32.xor
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 8
          i32.load
          local.tee 31
          i32.sub
          i32.const 9
          i32.shr_s
          local.tee 42
          local.get 15
          local.get 32
          i32.add
          local.tee 16
          i32.load8_u
          local.tee 43
          i32.mul
          local.get 1
          i32.load
          local.tee 1
          local.get 8
          i32.const -4
          i32.add
          i32.load
          local.tee 8
          i32.add
          i32.const 9
          i32.shr_s
          local.tee 44
          local.get 16
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 39
          i32.mul
          i32.sub
          local.tee 41
          local.get 8
          local.get 1
          i32.sub
          i32.const 1
          i32.shr_s
          local.tee 1
          i32.add
          i32.store
          local.get 4
          local.get 42
          local.get 39
          i32.mul
          local.get 44
          local.get 43
          i32.mul
          i32.add
          local.tee 8
          local.get 31
          local.get 14
          i32.add
          i32.const 1
          i32.shr_s
          local.tee 14
          i32.add
          i32.store
          local.get 2
          i32.const -4
          i32.add
          local.get 41
          local.get 1
          i32.sub
          i32.store
          local.get 2
          i32.const -8
          i32.add
          local.get 14
          local.get 8
          i32.sub
          i32.store
          local.get 4
          i32.const 12
          i32.add
          local.get 26
          local.get 11
          i32.const 16779297
          i32.add
          i32.load8_u
          i32.const 8
          i32.shl
          local.get 17
          i32.or
          local.tee 17
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 11
          i32.const 4
          i32.add
          i32.load
          local.tee 1
          local.get 26
          local.get 17
          i32.const 4095
          i32.xor
          local.get 29
          i32.shr_u
          i32.const 2
          i32.shl
          i32.add
          local.tee 17
          i32.load
          local.tee 14
          i32.sub
          i32.const 9
          i32.shr_s
          local.tee 8
          local.get 15
          local.get 33
          i32.add
          local.tee 15
          i32.load8_u
          local.tee 31
          i32.mul
          local.get 11
          i32.load
          local.tee 11
          local.get 17
          i32.const -4
          i32.add
          i32.load
          local.tee 17
          i32.add
          i32.const 9
          i32.shr_s
          local.tee 42
          local.get 15
          i32.const 1
          i32.add
          i32.load8_u
          local.tee 15
          i32.mul
          i32.sub
          local.tee 43
          local.get 17
          local.get 11
          i32.sub
          i32.const 1
          i32.shr_s
          local.tee 17
          i32.add
          i32.store
          local.get 4
          i32.const 8
          i32.add
          local.get 8
          local.get 15
          i32.mul
          local.get 42
          local.get 31
          i32.mul
          i32.add
          local.tee 15
          local.get 14
          local.get 1
          i32.add
          i32.const 1
          i32.shr_s
          local.tee 11
          i32.add
          i32.store
          local.get 2
          i32.const -12
          i32.add
          local.get 43
          local.get 17
          i32.sub
          i32.store
          local.get 2
          i32.const -16
          i32.add
          local.tee 2
          local.get 11
          local.get 15
          i32.sub
          i32.store
          local.get 10
          i32.const 2
          i32.add
          local.set 10
          local.get 16
          local.get 32
          i32.add
          local.set 15
          local.get 4
          i32.const 16
          i32.add
          local.tee 4
          local.get 2
          i32.lt_u
          br_if 0 (;@3;)
        end
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 30
                i32.const 2
                i32.shr_s
                local.tee 2
                br_table 2 (;@4;) 1 (;@5;) 0 (;@6;)
              end
              local.get 30
              i32.const 3
              i32.shr_u
              i32.const 16777232
              i32.add
              i32.const 16778272
              local.get 2
              i32.const 3
              i32.gt_s
              select
              local.set 16
              local.get 27
              local.set 10
              local.get 27
              local.set 15
              local.get 25
              local.set 4
              loop  ;; label = @6
                local.get 10
                i32.const -4
                i32.add
                i32.const 0
                local.get 4
                i32.const 4
                i32.add
                i32.load
                i32.sub
                i32.const 8
                i32.shr_s
                local.tee 17
                local.get 16
                i32.const 1
                i32.add
                i32.load8_u
                local.tee 11
                i32.mul
                local.get 4
                i32.load
                i32.const 8
                i32.shr_s
                local.tee 1
                local.get 16
                i32.load8_u
                local.tee 14
                i32.mul
                i32.add
                i32.store
                local.get 15
                local.get 17
                local.get 14
                i32.mul
                local.get 1
                local.get 11
                i32.mul
                i32.sub
                i32.store
                local.get 10
                i32.const -8
                i32.add
                i32.const 0
                local.get 4
                i32.const 12
                i32.add
                i32.load
                i32.sub
                i32.const 8
                i32.shr_s
                local.tee 17
                local.get 16
                local.get 2
                i32.add
                local.tee 16
                i32.const 1
                i32.add
                i32.load8_u
                local.tee 11
                i32.mul
                local.get 4
                i32.const 8
                i32.add
                i32.load
                i32.const 8
                i32.shr_s
                local.tee 1
                local.get 16
                i32.load8_u
                local.tee 14
                i32.mul
                i32.add
                i32.store
                local.get 15
                i32.const 4
                i32.add
                local.get 17
                local.get 14
                i32.mul
                local.get 1
                local.get 11
                i32.mul
                i32.sub
                i32.store
                local.get 10
                i32.const -12
                i32.add
                i32.const 0
                local.get 4
                i32.const 20
                i32.add
                i32.load
                i32.sub
                i32.const 8
                i32.shr_s
                local.tee 17
                local.get 16
                local.get 2
                i32.add
                local.tee 16
                i32.const 1
                i32.add
                i32.load8_u
                local.tee 11
                i32.mul
                local.get 4
                i32.const 16
                i32.add
                i32.load
                i32.const 8
                i32.shr_s
                local.tee 1
                local.get 16
                i32.load8_u
                local.tee 14
                i32.mul
                i32.add
                i32.store
                local.get 15
                i32.const 8
                i32.add
                local.get 17
                local.get 14
                i32.mul
                local.get 1
                local.get 11
                i32.mul
                i32.sub
                i32.store
                local.get 10
                i32.const -16
                i32.add
                local.tee 10
                i32.const 0
                local.get 4
                i32.const 28
                i32.add
                i32.load
                i32.sub
                i32.const 8
                i32.shr_s
                local.tee 17
                local.get 16
                local.get 2
                i32.add
                local.tee 16
                i32.const 1
                i32.add
                i32.load8_u
                local.tee 11
                i32.mul
                local.get 4
                i32.const 24
                i32.add
                i32.load
                i32.const 8
                i32.shr_s
                local.tee 1
                local.get 16
                i32.load8_u
                local.tee 14
                i32.mul
                i32.add
                i32.store
                local.get 15
                i32.const 12
                i32.add
                local.get 17
                local.get 14
                i32.mul
                local.get 1
                local.get 11
                i32.mul
                i32.sub
                i32.store
                local.get 15
                i32.const 16
                i32.add
                local.set 15
                local.get 16
                local.get 2
                i32.add
                local.set 16
                local.get 4
                i32.const 32
                i32.add
                local.tee 4
                local.get 10
                i32.lt_u
                br_if 0 (;@6;)
                br 3 (;@3;)
              end
            end
            i32.const 127
            local.set 16
            i32.const 0
            local.set 17
            i32.const 2
            local.set 4
            local.get 27
            local.set 10
            local.get 27
            local.set 15
            local.get 25
            local.set 2
            loop  ;; label = @5
              local.get 10
              i32.const -4
              i32.add
              i32.const 0
              local.get 2
              i32.const 4
              i32.add
              i32.load
              i32.sub
              i32.const 8
              i32.shr_s
              local.tee 11
              local.get 16
              local.get 4
              i32.const 16778271
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 1
              i32.add
              local.tee 16
              i32.mul
              local.get 2
              i32.load
              i32.const 8
              i32.shr_s
              local.tee 14
              local.get 17
              local.get 4
              i32.const 16778270
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 8
              i32.add
              local.tee 17
              i32.mul
              i32.add
              i32.store
              local.get 15
              local.get 11
              local.get 17
              i32.mul
              local.get 16
              local.get 14
              i32.mul
              i32.sub
              i32.store
              local.get 10
              i32.const -8
              i32.add
              i32.const 0
              local.get 2
              i32.const 12
              i32.add
              i32.load
              i32.sub
              i32.const 8
              i32.shr_s
              local.tee 16
              local.get 4
              i32.const 16777233
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 17
              local.get 1
              i32.add
              local.tee 11
              i32.mul
              local.get 2
              i32.const 8
              i32.add
              i32.load
              i32.const 8
              i32.shr_s
              local.tee 1
              local.get 4
              i32.const 16777232
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 14
              local.get 8
              i32.add
              local.tee 8
              i32.mul
              i32.add
              i32.store
              local.get 15
              i32.const 4
              i32.add
              local.get 16
              local.get 8
              i32.mul
              local.get 11
              local.get 1
              i32.mul
              i32.sub
              i32.store
              local.get 10
              i32.const -12
              i32.add
              i32.const 0
              local.get 2
              i32.const 20
              i32.add
              i32.load
              i32.sub
              i32.const 8
              i32.shr_s
              local.tee 16
              local.get 4
              i32.const 16778273
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 11
              local.get 17
              i32.add
              local.tee 17
              i32.mul
              local.get 2
              i32.const 16
              i32.add
              i32.load
              i32.const 8
              i32.shr_s
              local.tee 1
              local.get 4
              i32.const 16778272
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 8
              local.get 14
              i32.add
              local.tee 14
              i32.mul
              i32.add
              i32.store
              local.get 15
              i32.const 8
              i32.add
              local.get 16
              local.get 14
              i32.mul
              local.get 17
              local.get 1
              i32.mul
              i32.sub
              i32.store
              local.get 10
              i32.const -16
              i32.add
              local.tee 10
              i32.const 0
              local.get 2
              i32.const 28
              i32.add
              i32.load
              i32.sub
              i32.const 8
              i32.shr_s
              local.tee 1
              local.get 4
              i32.const 16777235
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 16
              local.get 11
              i32.add
              local.tee 11
              i32.mul
              local.get 2
              i32.const 24
              i32.add
              i32.load
              i32.const 8
              i32.shr_s
              local.tee 14
              local.get 4
              i32.const 16777234
              i32.add
              i32.load8_u
              i32.const 1
              i32.shr_u
              local.tee 17
              local.get 8
              i32.add
              local.tee 8
              i32.mul
              i32.add
              i32.store
              local.get 15
              i32.const 12
              i32.add
              local.get 1
              local.get 8
              i32.mul
              local.get 11
              local.get 14
              i32.mul
              i32.sub
              i32.store
              local.get 15
              i32.const 16
              i32.add
              local.set 15
              local.get 4
              i32.const 4
              i32.add
              local.set 4
              local.get 2
              i32.const 32
              i32.add
              local.tee 2
              local.get 10
              i32.lt_u
              br_if 0 (;@5;)
              br 2 (;@3;)
            end
          end
          i32.const 255
          local.set 17
          i32.const 2
          local.set 10
          local.get 27
          local.set 15
          local.get 27
          local.set 16
          local.get 25
          local.set 4
          loop  ;; label = @4
            local.get 15
            i32.const -4
            i32.add
            local.get 10
            i32.const 16778271
            i32.add
            i32.load8_u
            local.tee 11
            local.get 17
            i32.sub
            i32.const 2
            i32.shr_s
            local.tee 14
            local.get 17
            i32.add
            local.tee 17
            i32.const 0
            local.get 4
            i32.const 4
            i32.add
            i32.load
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 8
            i32.mul
            local.get 10
            i32.const 16778270
            i32.add
            i32.load8_u
            local.tee 1
            local.get 2
            i32.sub
            i32.const 2
            i32.shr_s
            local.tee 31
            local.get 2
            i32.add
            local.tee 2
            local.get 4
            i32.load
            i32.const 8
            i32.shr_s
            local.tee 42
            i32.mul
            i32.add
            i32.store
            local.get 16
            local.get 8
            local.get 2
            i32.mul
            local.get 17
            local.get 42
            i32.mul
            i32.sub
            i32.store
            local.get 15
            i32.const -8
            i32.add
            i32.const 0
            local.get 4
            i32.const 12
            i32.add
            i32.load
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 2
            local.get 11
            local.get 14
            i32.sub
            local.tee 17
            i32.mul
            local.get 4
            i32.const 8
            i32.add
            i32.load
            i32.const 8
            i32.shr_s
            local.tee 14
            local.get 1
            local.get 31
            i32.sub
            local.tee 8
            i32.mul
            i32.add
            i32.store
            local.get 16
            i32.const 4
            i32.add
            local.get 2
            local.get 8
            i32.mul
            local.get 14
            local.get 17
            i32.mul
            i32.sub
            i32.store
            local.get 15
            i32.const -12
            i32.add
            local.get 11
            local.get 10
            i32.const 16777233
            i32.add
            i32.load8_u
            local.tee 17
            local.get 11
            i32.sub
            i32.const 2
            i32.shr_s
            local.tee 14
            i32.add
            local.tee 11
            i32.const 0
            local.get 4
            i32.const 20
            i32.add
            i32.load
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 8
            i32.mul
            local.get 1
            local.get 10
            i32.const 16777232
            i32.add
            i32.load8_u
            local.tee 2
            local.get 1
            i32.sub
            i32.const 2
            i32.shr_s
            local.tee 31
            i32.add
            local.tee 1
            local.get 4
            i32.const 16
            i32.add
            i32.load
            i32.const 8
            i32.shr_s
            local.tee 42
            i32.mul
            i32.add
            i32.store
            local.get 16
            i32.const 8
            i32.add
            local.get 8
            local.get 1
            i32.mul
            local.get 11
            local.get 42
            i32.mul
            i32.sub
            i32.store
            local.get 15
            i32.const -16
            i32.add
            local.tee 15
            i32.const 0
            local.get 4
            i32.const 28
            i32.add
            i32.load
            i32.sub
            i32.const 8
            i32.shr_s
            local.tee 11
            local.get 17
            local.get 14
            i32.sub
            local.tee 1
            i32.mul
            local.get 4
            i32.const 24
            i32.add
            i32.load
            i32.const 8
            i32.shr_s
            local.tee 14
            local.get 2
            local.get 31
            i32.sub
            local.tee 8
            i32.mul
            i32.add
            i32.store
            local.get 16
            i32.const 12
            i32.add
            local.get 11
            local.get 8
            i32.mul
            local.get 14
            local.get 1
            i32.mul
            i32.sub
            i32.store
            local.get 16
            i32.const 16
            i32.add
            local.set 16
            local.get 10
            i32.const 2
            i32.add
            local.set 10
            local.get 4
            i32.const 32
            i32.add
            local.tee 4
            local.get 15
            i32.lt_u
            br_if 0 (;@4;)
          end
        end
        local.get 25
        local.get 21
        i32.add
        local.set 4
        loop  ;; label = @3
          local.get 4
          i32.const 12
          i32.add
          local.get 4
          local.get 12
          i32.add
          local.tee 2
          i32.const 12
          i32.add
          i32.load
          local.tee 10
          i32.store
          local.get 28
          i32.const 0
          local.get 10
          i32.sub
          i32.store
          local.get 4
          i32.const 8
          i32.add
          local.get 2
          i32.const 8
          i32.add
          i32.load
          local.tee 10
          i32.store
          local.get 28
          i32.const 4
          i32.add
          i32.const 0
          local.get 10
          i32.sub
          i32.store
          local.get 4
          i32.const 4
          i32.add
          local.get 2
          i32.const 4
          i32.add
          i32.load
          local.tee 10
          i32.store
          local.get 28
          i32.const 8
          i32.add
          i32.const 0
          local.get 10
          i32.sub
          i32.store
          local.get 4
          local.get 2
          i32.load
          local.tee 10
          i32.store
          local.get 28
          i32.const 12
          i32.add
          i32.const 0
          local.get 10
          i32.sub
          i32.store
          local.get 4
          i32.const -16
          i32.add
          local.set 4
          local.get 28
          i32.const 16
          i32.add
          local.tee 28
          local.get 2
          i32.lt_u
          br_if 0 (;@3;)
        end
        local.get 27
        local.set 4
        loop  ;; label = @3
          local.get 27
          i32.const -16
          i32.add
          local.tee 2
          local.get 4
          i32.const 12
          i32.add
          i32.load
          i32.store
          local.get 27
          i32.const -12
          i32.add
          local.get 4
          i32.const 8
          i32.add
          i32.load
          i32.store
          local.get 27
          i32.const -8
          i32.add
          local.get 4
          i32.const 4
          i32.add
          i32.load
          i32.store
          local.get 27
          i32.const -4
          i32.add
          local.get 4
          i32.load
          i32.store
          local.get 4
          i32.const 16
          i32.add
          local.set 4
          local.get 2
          local.set 27
          local.get 2
          local.get 26
          i32.gt_u
          br_if 0 (;@3;)
        end
        local.get 24
        i32.const 1
        i32.add
        local.tee 24
        local.get 5
        i32.load offset=4
        local.tee 2
        i32.lt_s
        br_if 0 (;@2;)
      end
      local.get 2
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 7
      i32.const 2
      i32.shl
      local.set 26
      local.get 0
      i32.load
      local.set 44
      local.get 7
      i32.const 1
      i32.lt_s
      local.set 37
      i32.const 0
      local.set 1
      loop  ;; label = @2
        local.get 44
        local.get 1
        i32.const 2
        i32.shl
        local.tee 4
        i32.add
        i32.load
        local.set 14
        block  ;; label = @3
          block  ;; label = @4
            local.get 13
            local.get 4
            i32.add
            i32.load
            br_if 0 (;@4;)
            local.get 37
            br_if 1 (;@3;)
            local.get 14
            i32.const 0
            local.get 26
            call $memset
            drop
            br 1 (;@3;)
          end
          local.get 0
          i32.load offset=32
          local.set 2
          local.get 0
          i32.load offset=24
          local.set 4
          local.get 0
          i32.load offset=28
          local.set 10
          local.get 3
          local.get 9
          i64.load align=4
          i64.store offset=8 align=4
          local.get 6
          local.get 4
          i32.const 2
          i32.shl
          local.tee 15
          i32.add
          i32.load
          local.tee 4
          i32.const -4
          i32.div_s
          local.get 6
          local.get 10
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.tee 8
          i32.const 4
          i32.div_s
          local.tee 10
          i32.add
          local.tee 12
          local.get 4
          i32.const 2
          i32.div_s
          i32.add
          local.set 4
          local.get 8
          i32.const 2
          i32.div_s
          local.get 10
          i32.add
          local.tee 41
          local.get 6
          local.get 2
          i32.const 2
          i32.shl
          local.tee 39
          i32.add
          i32.load
          local.tee 42
          i32.const -4
          i32.div_s
          local.tee 38
          i32.add
          local.set 11
          local.get 42
          i32.const 2
          i32.div_s
          local.set 31
          block  ;; label = @4
            block  ;; label = @5
              local.get 12
              i32.const 1
              i32.ge_s
              br_if 0 (;@5;)
              i32.const 0
              local.set 12
              br 1 (;@4;)
            end
            local.get 14
            i32.const 0
            local.get 12
            i32.const 2
            i32.shl
            call $memset
            drop
          end
          local.get 11
          local.get 31
          i32.add
          local.set 43
          block  ;; label = @4
            local.get 4
            local.get 12
            i32.le_s
            br_if 0 (;@4;)
            local.get 4
            local.get 12
            i32.sub
            local.tee 10
            i32.const 1
            i32.and
            local.set 40
            local.get 3
            i32.const 8
            i32.add
            local.get 15
            i32.add
            i32.load
            local.set 16
            i32.const 0
            local.set 2
            block  ;; label = @5
              local.get 4
              local.get 12
              i32.const 1
              i32.add
              i32.eq
              br_if 0 (;@5;)
              local.get 10
              i32.const -2
              i32.and
              local.set 17
              local.get 14
              local.get 12
              i32.const 2
              i32.shl
              i32.add
              local.set 4
              i32.const 0
              local.set 2
              loop  ;; label = @6
                local.get 4
                local.get 4
                i32.load
                i32.const 8
                i32.shr_s
                local.get 16
                local.get 2
                i32.add
                local.tee 10
                i32.load8_u
                i32.mul
                i32.store
                local.get 4
                i32.const 4
                i32.add
                local.tee 15
                local.get 15
                i32.load
                i32.const 8
                i32.shr_s
                local.get 10
                i32.const 1
                i32.add
                i32.load8_u
                i32.mul
                i32.store
                local.get 4
                i32.const 8
                i32.add
                local.set 4
                local.get 17
                local.get 2
                i32.const 2
                i32.add
                local.tee 2
                i32.ne
                br_if 0 (;@6;)
              end
              local.get 12
              local.get 2
              i32.add
              local.set 12
            end
            local.get 40
            i32.eqz
            br_if 0 (;@4;)
            local.get 14
            local.get 12
            i32.const 2
            i32.shl
            i32.add
            local.tee 4
            local.get 4
            i32.load
            i32.const 8
            i32.shr_s
            local.get 16
            local.get 2
            i32.add
            i32.load8_u
            i32.mul
            i32.store
          end
          block  ;; label = @4
            local.get 11
            local.get 43
            i32.ge_s
            br_if 0 (;@4;)
            local.get 3
            i32.const 8
            i32.add
            local.get 39
            i32.add
            i32.load
            local.set 2
            block  ;; label = @5
              block  ;; label = @6
                local.get 31
                i32.const 1
                i32.and
                br_if 0 (;@6;)
                local.get 31
                local.set 10
                br 1 (;@5;)
              end
              local.get 14
              local.get 11
              i32.const 2
              i32.shl
              i32.add
              local.tee 4
              local.get 4
              i32.load
              i32.const 8
              i32.shr_s
              local.get 2
              local.get 31
              i32.const -1
              i32.add
              local.tee 10
              i32.add
              i32.load8_u
              i32.mul
              i32.store
              local.get 11
              i32.const 1
              i32.add
              local.set 11
            end
            block  ;; label = @5
              local.get 42
              i32.const -2
              i32.and
              i32.const 2
              i32.eq
              br_if 0 (;@5;)
              local.get 14
              local.get 11
              i32.const 2
              i32.shl
              i32.add
              local.set 4
              local.get 2
              local.get 10
              i32.add
              i32.const -2
              i32.add
              local.set 2
              local.get 41
              local.get 38
              i32.add
              local.get 31
              i32.add
              local.get 11
              i32.sub
              local.set 10
              loop  ;; label = @6
                local.get 4
                local.get 4
                i32.load
                i32.const 8
                i32.shr_s
                local.get 2
                i32.const 1
                i32.add
                i32.load8_u
                i32.mul
                i32.store
                local.get 4
                i32.const 4
                i32.add
                local.tee 15
                local.get 15
                i32.load
                i32.const 8
                i32.shr_s
                local.get 2
                i32.load8_u
                i32.mul
                i32.store
                local.get 4
                i32.const 8
                i32.add
                local.set 4
                local.get 2
                i32.const -2
                i32.add
                local.set 2
                local.get 10
                i32.const -2
                i32.add
                local.tee 10
                br_if 0 (;@6;)
              end
            end
            local.get 43
            local.set 11
          end
          local.get 8
          local.get 11
          i32.le_s
          br_if 0 (;@3;)
          local.get 14
          local.get 11
          i32.const 2
          i32.shl
          i32.add
          i32.const 0
          local.get 8
          local.get 11
          i32.sub
          i32.const 2
          i32.shl
          call $memset
          drop
        end
        local.get 1
        i32.const 1
        i32.add
        local.tee 1
        local.get 5
        i32.load offset=4
        local.tee 2
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    i32.const 0
    i32.const 0
    i32.load offset=16799524
    local.get 2
    i32.add
    i32.store offset=16799524
    local.get 3
    i32.const 16
    i32.add
    global.set $__stack_pointer
    i32.const 0)
  (func $__wasi_proc_exit (type 4) (param i32)
    local.get 0
    call $wasi_proc_exit
    unreachable)
  (func $__wasilibc_populate_preopens (type 7)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 0
    global.set $__stack_pointer
    i32.const 3
    local.set 1
    block  ;; label = @1
      loop  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  block  ;; label = @8
                    local.get 1
                    local.get 0
                    i32.const 8
                    i32.add
                    call $wasi_fd_prestat_get
                    i32.const 65535
                    i32.and
                    local.tee 2
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 2
                    i32.const 8
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 0
                    i32.const 16
                    i32.add
                    global.set $__stack_pointer
                    return
                  end
                  local.get 0
                  i32.load8_u offset=8
                  br_if 4 (;@3;)
                  local.get 0
                  i32.load offset=12
                  local.tee 2
                  i32.const 1
                  i32.add
                  call $malloc
                  local.tee 3
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 1
                  local.get 3
                  local.get 2
                  call $wasi_fd_prestat_dir_name
                  i32.const 65535
                  i32.and
                  br_if 0 (;@7;)
                  local.get 3
                  local.get 0
                  i32.load offset=12
                  i32.add
                  i32.const 0
                  i32.store8
                  block  ;; label = @8
                    i32.const 0
                    i32.load offset=16799508
                    local.tee 4
                    i32.const 0
                    i32.load offset=16799516
                    i32.ne
                    br_if 0 (;@8;)
                    i32.const 0
                    i32.load offset=16799512
                    local.set 2
                    i32.const 8
                    local.get 4
                    i32.const 1
                    i32.shl
                    i32.const 4
                    local.get 4
                    select
                    local.tee 5
                    call $calloc
                    local.tee 6
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 6
                    local.get 2
                    local.get 4
                    i32.const 3
                    i32.shl
                    call $memcpy
                    local.set 6
                    i32.const 0
                    local.get 5
                    i32.store offset=16799516
                    i32.const 0
                    local.get 6
                    i32.store offset=16799512
                    local.get 2
                    call $free
                  end
                  local.get 3
                  local.set 5
                  block  ;; label = @8
                    loop  ;; label = @9
                      block  ;; label = @10
                        block  ;; label = @11
                          local.get 5
                          local.tee 2
                          i32.load8_u
                          local.tee 6
                          i32.const -46
                          i32.add
                          br_table 1 (;@10;) 0 (;@11;) 3 (;@8;)
                        end
                        local.get 2
                        i32.const 1
                        i32.add
                        local.set 5
                        br 1 (;@9;)
                      end
                      local.get 2
                      i32.const 1
                      i32.add
                      local.set 5
                      local.get 2
                      i32.load8_u offset=1
                      local.tee 7
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 7
                      i32.const 47
                      i32.ne
                      br_if 1 (;@8;)
                      local.get 2
                      i32.const 2
                      i32.add
                      local.set 5
                      br 0 (;@9;)
                    end
                  end
                  local.get 2
                  local.set 5
                  local.get 2
                  i32.const 3
                  i32.and
                  i32.eqz
                  br_if 2 (;@5;)
                  block  ;; label = @8
                    local.get 6
                    br_if 0 (;@8;)
                    local.get 2
                    local.set 5
                    br 4 (;@4;)
                  end
                  local.get 2
                  i32.const 1
                  i32.add
                  local.tee 5
                  i32.const 3
                  i32.and
                  br_if 1 (;@6;)
                  br 2 (;@5;)
                end
                i32.const 71
                call $_Exit
                unreachable
              end
              local.get 5
              i32.load8_u
              i32.eqz
              br_if 1 (;@4;)
              local.get 2
              i32.const 2
              i32.add
              local.tee 5
              i32.const 3
              i32.and
              i32.eqz
              br_if 0 (;@5;)
              local.get 5
              i32.load8_u
              i32.eqz
              br_if 1 (;@4;)
              local.get 2
              i32.const 3
              i32.add
              local.tee 5
              i32.const 3
              i32.and
              i32.eqz
              br_if 0 (;@5;)
              local.get 5
              i32.load8_u
              i32.eqz
              br_if 1 (;@4;)
              local.get 2
              i32.const 4
              i32.add
              local.tee 5
              i32.const 3
              i32.and
              br_if 1 (;@4;)
            end
            local.get 5
            i32.const -1
            i32.add
            local.set 6
            local.get 5
            i32.const -4
            i32.add
            local.set 7
            loop  ;; label = @5
              local.get 6
              local.tee 5
              i32.const 4
              i32.add
              local.set 6
              local.get 7
              i32.const 4
              i32.add
              local.tee 7
              i32.load
              local.tee 8
              i32.const -1
              i32.xor
              local.get 8
              i32.const -16843009
              i32.add
              i32.and
              i32.const -2139062144
              i32.and
              i32.eqz
              br_if 0 (;@5;)
            end
            loop  ;; label = @5
              local.get 5
              i32.const 1
              i32.add
              local.tee 5
              i32.load8_u
              br_if 0 (;@5;)
            end
          end
          local.get 5
          local.get 2
          i32.sub
          i32.const 1
          i32.add
          local.tee 5
          call $malloc
          local.tee 6
          i32.eqz
          br_if 2 (;@1;)
          local.get 6
          local.get 2
          local.get 5
          call $memcpy
          local.set 2
          i32.const 0
          local.get 4
          i32.const 1
          i32.add
          i32.store offset=16799508
          i32.const 0
          i32.load offset=16799512
          local.get 4
          i32.const 3
          i32.shl
          i32.add
          local.tee 5
          local.get 1
          i32.store offset=4
          local.get 5
          local.get 2
          i32.store
          local.get 3
          call $free
        end
        local.get 1
        i32.const 1
        i32.add
        local.set 1
        br 0 (;@2;)
      end
    end
    i32.const 70
    call $_Exit
    unreachable)
  (func $_Exit (type 4) (param i32)
    local.get 0
    call $__wasi_proc_exit
    unreachable)
  (func $res0_free_info (type 4) (param i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      call $free
    end)
  (func $res0_free_look (type 4) (param i32)
    (local i32 i32 i32 i32)
    block  ;; label = @1
      local.get 0
      i32.eqz
      br_if 0 (;@1;)
      block  ;; label = @2
        local.get 0
        i32.load offset=8
        local.tee 1
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 2
        i32.const 0
        local.set 3
        loop  ;; label = @3
          block  ;; label = @4
            local.get 0
            i32.load offset=24
            local.get 2
            i32.add
            i32.load
            local.tee 4
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            call $free
            local.get 0
            i32.load offset=8
            local.set 1
          end
          local.get 2
          i32.const 4
          i32.add
          local.set 2
          local.get 3
          i32.const 1
          i32.add
          local.tee 3
          local.get 1
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 0
      i32.load offset=24
      call $free
      block  ;; label = @2
        local.get 0
        i32.load offset=28
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 2
        i32.const 0
        local.set 3
        loop  ;; label = @3
          local.get 0
          i32.load offset=32
          local.get 2
          i32.add
          i32.load
          call $free
          local.get 2
          i32.const 4
          i32.add
          local.set 2
          local.get 3
          i32.const 1
          i32.add
          local.tee 3
          local.get 0
          i32.load offset=28
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      local.get 0
      i32.load offset=32
      call $free
      local.get 0
      call $free
    end)
  (func $res0_unpack (type 5) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32)
    i32.const 1
    i32.const 2328
    call $calloc
    local.set 2
    local.get 0
    i32.load offset=28
    local.set 3
    local.get 2
    local.get 1
    i32.const 24
    call $oggpack_read
    i32.store
    local.get 2
    local.get 1
    i32.const 24
    call $oggpack_read
    i32.store offset=4
    local.get 2
    local.get 1
    i32.const 24
    call $oggpack_read
    i32.const 1
    i32.add
    i32.store offset=8
    local.get 2
    local.get 1
    i32.const 6
    call $oggpack_read
    local.tee 0
    i32.const 1
    i32.add
    i32.store offset=12
    local.get 2
    local.get 1
    i32.const 8
    call $oggpack_read
    local.tee 4
    i32.store offset=20
    block  ;; label = @1
      local.get 4
      i32.const 0
      i32.lt_s
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 0
            i32.const 2147483646
            i32.gt_u
            br_if 0 (;@4;)
            i32.const 0
            local.set 5
            i32.const 0
            local.set 6
            loop  ;; label = @5
              local.get 1
              i32.const 3
              call $oggpack_read
              local.set 0
              local.get 1
              i32.const 1
              call $oggpack_read
              local.tee 4
              i32.const 0
              i32.lt_s
              br_if 4 (;@1;)
              block  ;; label = @6
                local.get 4
                i32.eqz
                br_if 0 (;@6;)
                local.get 1
                i32.const 5
                call $oggpack_read
                local.tee 4
                i32.const 0
                i32.lt_s
                br_if 5 (;@1;)
                local.get 4
                i32.const 3
                i32.shl
                local.get 0
                i32.or
                local.set 0
              end
              local.get 2
              local.get 5
              i32.const 2
              i32.shl
              i32.add
              i32.const 24
              i32.add
              local.get 0
              i32.store
              block  ;; label = @6
                block  ;; label = @7
                  local.get 0
                  br_if 0 (;@7;)
                  i32.const 0
                  local.set 4
                  br 1 (;@6;)
                end
                i32.const 0
                local.set 4
                loop  ;; label = @7
                  local.get 0
                  i32.const 1
                  i32.and
                  local.get 4
                  i32.add
                  local.set 4
                  local.get 0
                  i32.const 1
                  i32.gt_u
                  local.set 7
                  local.get 0
                  i32.const 1
                  i32.shr_u
                  local.set 0
                  local.get 7
                  br_if 0 (;@7;)
                end
              end
              local.get 4
              local.get 6
              i32.add
              local.set 6
              local.get 5
              i32.const 1
              i32.add
              local.tee 5
              local.get 2
              i32.load offset=12
              i32.ge_s
              br_if 2 (;@3;)
              br 0 (;@5;)
            end
          end
          local.get 4
          local.get 3
          i32.load offset=28
          i32.ge_s
          br_if 2 (;@1;)
          br 1 (;@2;)
        end
        block  ;; label = @3
          local.get 6
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          local.get 2
          i32.const 280
          i32.add
          local.set 0
          local.get 6
          local.set 4
          loop  ;; label = @4
            local.get 1
            i32.const 8
            call $oggpack_read
            local.tee 7
            i32.const 0
            i32.lt_s
            br_if 3 (;@1;)
            local.get 0
            local.get 7
            i32.store
            local.get 0
            i32.const 4
            i32.add
            local.set 0
            local.get 4
            i32.const -1
            i32.add
            local.tee 4
            br_if 0 (;@4;)
          end
          local.get 2
          i32.load offset=20
          local.tee 4
          local.get 3
          i32.load offset=28
          local.tee 1
          i32.ge_s
          br_if 2 (;@1;)
          local.get 2
          i32.const 280
          i32.add
          local.set 0
          loop  ;; label = @4
            local.get 0
            i32.load
            local.tee 7
            local.get 1
            i32.ge_s
            br_if 3 (;@1;)
            local.get 3
            local.get 7
            i32.const 2
            i32.shl
            i32.add
            i32.const 2080
            i32.add
            i32.load
            i32.load offset=12
            i32.eqz
            br_if 3 (;@1;)
            local.get 0
            i32.const 4
            i32.add
            local.set 0
            local.get 6
            i32.const -1
            i32.add
            local.tee 6
            i32.eqz
            br_if 2 (;@2;)
            br 0 (;@4;)
          end
        end
        local.get 2
        i32.load offset=20
        local.tee 4
        local.get 3
        i32.load offset=28
        i32.ge_s
        br_if 1 (;@1;)
      end
      i32.const 1
      local.set 0
      local.get 3
      local.get 4
      i32.const 2
      i32.shl
      i32.add
      i32.const 2080
      i32.add
      i32.load
      local.tee 4
      i32.load
      local.tee 1
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 4
      i32.load offset=4
      local.set 7
      local.get 1
      i32.const 1
      i32.add
      local.set 4
      local.get 2
      i32.load offset=12
      local.set 1
      loop  ;; label = @2
        local.get 1
        local.get 0
        i32.mul
        local.tee 0
        local.get 7
        i32.gt_s
        br_if 1 (;@1;)
        local.get 4
        i32.const -1
        i32.add
        local.tee 4
        i32.const 2
        i32.ge_s
        br_if 0 (;@2;)
      end
      local.get 2
      local.get 0
      i32.store offset=16
      local.get 2
      return
    end
    local.get 2
    call $free
    i32.const 0)
  (func $res0_look (type 3) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    i32.const 1
    i32.const 36
    call $calloc
    local.tee 3
    local.get 2
    i32.store
    local.get 3
    local.get 1
    i32.load offset=12
    i32.store offset=4
    local.get 3
    local.get 2
    i32.load offset=12
    local.tee 4
    i32.store offset=8
    local.get 3
    local.get 0
    i32.load offset=4
    i32.load offset=28
    local.tee 5
    i32.load offset=3104
    local.tee 1
    i32.store offset=16
    local.get 3
    local.get 1
    local.get 2
    i32.load offset=20
    i32.const 52
    i32.mul
    i32.add
    local.tee 1
    i32.store offset=20
    local.get 1
    i32.load
    local.set 6
    local.get 3
    local.get 4
    i32.const 4
    call $calloc
    local.tee 7
    i32.store offset=24
    block  ;; label = @1
      block  ;; label = @2
        local.get 4
        i32.const 1
        i32.ge_s
        br_if 0 (;@2;)
        i32.const 0
        local.set 8
        br 1 (;@1;)
      end
      i32.const 0
      local.set 9
      i32.const 0
      local.set 8
      i32.const 0
      local.set 0
      loop  ;; label = @2
        block  ;; label = @3
          local.get 2
          local.get 9
          i32.const 2
          i32.shl
          local.tee 10
          i32.add
          i32.const 24
          i32.add
          i32.load
          local.tee 11
          i32.eqz
          br_if 0 (;@3;)
          i32.const 0
          local.set 12
          local.get 11
          local.set 1
          loop  ;; label = @4
            local.get 12
            local.tee 13
            i32.const 1
            i32.add
            local.set 12
            local.get 1
            i32.const 1
            i32.gt_u
            local.set 14
            local.get 1
            i32.const 1
            i32.shr_u
            local.set 1
            local.get 14
            br_if 0 (;@4;)
          end
          local.get 7
          local.get 10
          i32.add
          local.tee 10
          local.get 12
          i32.const 4
          call $calloc
          i32.store
          block  ;; label = @4
            block  ;; label = @5
              local.get 13
              br_if 0 (;@5;)
              i32.const 0
              local.set 1
              br 1 (;@4;)
            end
            local.get 12
            i32.const 2147483646
            i32.and
            local.set 15
            i32.const 0
            local.set 14
            i32.const 4
            local.set 1
            loop  ;; label = @5
              block  ;; label = @6
                local.get 11
                local.get 14
                local.tee 13
                i32.shr_u
                i32.const 1
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 10
                i32.load
                local.get 1
                i32.add
                i32.const -4
                i32.add
                local.get 5
                i32.load offset=3104
                local.get 2
                local.get 0
                i32.const 2
                i32.shl
                i32.add
                i32.const 280
                i32.add
                i32.load
                i32.const 52
                i32.mul
                i32.add
                i32.store
                local.get 0
                i32.const 1
                i32.add
                local.set 0
              end
              block  ;; label = @6
                local.get 11
                local.get 13
                i32.const 1
                i32.add
                local.tee 14
                i32.shr_u
                i32.const 1
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 10
                i32.load
                local.get 1
                i32.add
                local.get 5
                i32.load offset=3104
                local.get 2
                local.get 0
                i32.const 2
                i32.shl
                i32.add
                i32.const 280
                i32.add
                i32.load
                i32.const 52
                i32.mul
                i32.add
                i32.store
                local.get 0
                i32.const 1
                i32.add
                local.set 0
              end
              local.get 1
              i32.const 8
              i32.add
              local.set 1
              local.get 14
              i32.const 1
              i32.add
              local.tee 14
              local.get 15
              i32.ne
              br_if 0 (;@5;)
            end
            local.get 13
            i32.const 2
            i32.add
            local.set 1
          end
          block  ;; label = @4
            local.get 12
            i32.const 1
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 11
            local.get 1
            i32.shr_u
            i32.const 1
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 10
            i32.load
            local.get 1
            i32.const 2
            i32.shl
            i32.add
            local.get 5
            i32.load offset=3104
            local.get 2
            local.get 0
            i32.const 2
            i32.shl
            i32.add
            i32.const 280
            i32.add
            i32.load
            i32.const 52
            i32.mul
            i32.add
            i32.store
            local.get 0
            i32.const 1
            i32.add
            local.set 0
          end
          local.get 12
          local.get 8
          local.get 12
          local.get 8
          i32.gt_s
          select
          local.set 8
        end
        local.get 9
        i32.const 1
        i32.add
        local.tee 9
        local.get 4
        i32.ne
        br_if 0 (;@2;)
      end
    end
    local.get 3
    local.get 4
    i32.store offset=28
    local.get 4
    local.set 10
    block  ;; label = @1
      local.get 6
      i32.const 2
      i32.lt_s
      br_if 0 (;@1;)
      local.get 6
      i32.const -1
      i32.add
      i32.const 7
      i32.and
      local.set 1
      local.get 4
      local.set 10
      block  ;; label = @2
        local.get 6
        i32.const -2
        i32.add
        i32.const 7
        i32.lt_u
        br_if 0 (;@2;)
        local.get 4
        local.set 10
        block  ;; label = @3
          local.get 6
          i32.const -9
          i32.add
          local.tee 12
          i32.const 8
          i32.lt_u
          br_if 0 (;@3;)
          local.get 12
          i32.const 3
          i32.shr_u
          i32.const 1
          i32.add
          i32.const 1073741822
          i32.and
          local.set 0
          local.get 4
          local.set 10
          loop  ;; label = @4
            local.get 10
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.get 4
            i32.mul
            local.set 10
            local.get 0
            i32.const -2
            i32.add
            local.tee 0
            br_if 0 (;@4;)
          end
        end
        local.get 12
        i32.const 8
        i32.and
        br_if 0 (;@2;)
        local.get 10
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.get 4
        i32.mul
        local.set 10
      end
      block  ;; label = @2
        local.get 1
        i32.eqz
        br_if 0 (;@2;)
        loop  ;; label = @3
          local.get 10
          local.get 4
          i32.mul
          local.set 10
          local.get 1
          i32.const -1
          i32.add
          local.tee 1
          br_if 0 (;@3;)
        end
      end
      local.get 3
      local.get 10
      i32.store offset=28
    end
    local.get 3
    local.get 8
    i32.store offset=12
    local.get 3
    local.get 10
    i32.const 2
    i32.shl
    call $malloc
    local.tee 15
    i32.store offset=32
    block  ;; label = @1
      local.get 10
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 6
      i32.const 2147483646
      i32.and
      local.set 13
      local.get 6
      i32.const 1
      i32.and
      local.set 8
      local.get 6
      i32.const 2
      i32.shl
      local.set 9
      i32.const 0
      local.set 2
      loop  ;; label = @2
        local.get 15
        local.get 2
        i32.const 2
        i32.shl
        i32.add
        local.get 9
        call $malloc
        local.tee 5
        i32.store
        block  ;; label = @3
          local.get 6
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          i32.const 0
          local.set 14
          local.get 2
          local.set 0
          local.get 10
          local.set 12
          block  ;; label = @4
            local.get 6
            i32.const 1
            i32.eq
            br_if 0 (;@4;)
            i32.const 0
            local.set 14
            local.get 5
            local.set 1
            local.get 10
            local.set 12
            local.get 2
            local.set 0
            loop  ;; label = @5
              local.get 1
              local.get 0
              local.get 12
              local.get 4
              i32.div_s
              local.tee 12
              i32.div_s
              local.tee 11
              i32.store
              local.get 1
              i32.const 4
              i32.add
              local.get 0
              local.get 11
              local.get 12
              i32.mul
              i32.sub
              local.tee 0
              local.get 12
              local.get 4
              i32.div_s
              local.tee 12
              i32.div_s
              local.tee 11
              i32.store
              local.get 0
              local.get 11
              local.get 12
              i32.mul
              i32.sub
              local.set 0
              local.get 1
              i32.const 8
              i32.add
              local.set 1
              local.get 13
              local.get 14
              i32.const 2
              i32.add
              local.tee 14
              i32.ne
              br_if 0 (;@5;)
            end
            local.get 8
            i32.eqz
            br_if 1 (;@3;)
          end
          local.get 5
          local.get 14
          i32.const 2
          i32.shl
          i32.add
          local.get 0
          local.get 12
          local.get 4
          i32.div_s
          i32.div_s
          i32.store
        end
        local.get 2
        i32.const 1
        i32.add
        local.tee 2
        local.get 10
        i32.ne
        br_if 0 (;@2;)
      end
    end
    local.get 3)
  (func $res0_inverse (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 4
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      i32.const 0
      local.set 5
      i32.const 0
      local.set 6
      block  ;; label = @2
        block  ;; label = @3
          local.get 4
          i32.const 1
          i32.eq
          br_if 0 (;@3;)
          local.get 4
          i32.const 1
          i32.and
          local.set 7
          local.get 4
          i32.const 2147483646
          i32.and
          local.set 8
          i32.const 0
          local.set 6
          local.get 3
          local.set 4
          local.get 2
          local.set 9
          i32.const 0
          local.set 5
          loop  ;; label = @4
            block  ;; label = @5
              local.get 4
              i32.load
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              local.get 6
              i32.const 2
              i32.shl
              i32.add
              local.get 9
              i32.load
              i32.store
              local.get 6
              i32.const 1
              i32.add
              local.set 6
            end
            block  ;; label = @5
              local.get 4
              i32.const 4
              i32.add
              i32.load
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              local.get 6
              i32.const 2
              i32.shl
              i32.add
              local.get 9
              i32.const 4
              i32.add
              i32.load
              i32.store
              local.get 6
              i32.const 1
              i32.add
              local.set 6
            end
            local.get 4
            i32.const 8
            i32.add
            local.set 4
            local.get 9
            i32.const 8
            i32.add
            local.set 9
            local.get 8
            local.get 5
            i32.const 2
            i32.add
            local.tee 5
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 7
          i32.eqz
          br_if 1 (;@2;)
        end
        local.get 3
        local.get 5
        i32.const 2
        i32.shl
        local.tee 4
        i32.add
        i32.load
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        local.get 6
        i32.const 2
        i32.shl
        i32.add
        local.get 2
        local.get 4
        i32.add
        i32.load
        i32.store
        local.get 6
        i32.const 1
        i32.add
        local.set 6
      end
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      local.get 2
      local.get 6
      i32.const 5
      call $_01inverse
    end
    i32.const 0)
  (func $vorbis_book_decodevs_add (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    local.tee 5
    local.set 6
    i32.const 0
    local.set 7
    block  ;; label = @1
      local.get 0
      i32.load offset=8
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 5
      local.get 3
      local.get 0
      i32.load
      local.tee 8
      i32.div_s
      local.tee 9
      i32.const 2
      i32.shl
      i32.const 15
      i32.add
      i32.const -16
      i32.and
      i32.sub
      local.tee 10
      global.set $__stack_pointer
      block  ;; label = @2
        block  ;; label = @3
          local.get 4
          local.get 0
          i32.load offset=12
          i32.sub
          local.tee 11
          i32.const -1
          i32.gt_s
          br_if 0 (;@3;)
          block  ;; label = @4
            local.get 9
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 10
            local.set 4
            local.get 9
            local.set 5
            loop  ;; label = @5
              block  ;; label = @6
                local.get 0
                local.get 2
                call $decode_packed_entry_number
                local.tee 12
                i32.const -1
                i32.ne
                br_if 0 (;@6;)
                local.get 6
                global.set $__stack_pointer
                i32.const -1
                return
              end
              local.get 4
              local.get 0
              i32.load offset=16
              local.get 0
              i32.load
              local.tee 8
              local.get 12
              i32.mul
              i32.const 2
              i32.shl
              i32.add
              i32.store
              local.get 4
              i32.const 4
              i32.add
              local.set 4
              local.get 5
              i32.const -1
              i32.add
              local.tee 5
              br_if 0 (;@5;)
            end
          end
          local.get 8
          i32.const 1
          i32.lt_s
          br_if 2 (;@1;)
          local.get 9
          i32.const 2
          i32.shl
          local.set 13
          i32.const 0
          local.set 2
          i32.const 0
          local.get 11
          i32.sub
          local.set 11
          local.get 9
          i32.const 1
          i32.lt_s
          local.set 14
          i32.const 0
          local.set 7
          loop  ;; label = @4
            block  ;; label = @5
              local.get 14
              br_if 0 (;@5;)
              local.get 2
              local.get 3
              i32.ge_s
              br_if 0 (;@5;)
              i32.const 1
              local.set 4
              local.get 10
              local.set 5
              local.get 1
              local.set 0
              loop  ;; label = @6
                local.get 0
                local.get 0
                i32.load
                local.get 5
                i32.load
                local.get 7
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.get 11
                i32.shl
                i32.add
                i32.store
                local.get 4
                local.get 9
                i32.ge_s
                br_if 1 (;@5;)
                local.get 2
                local.get 4
                i32.add
                local.set 12
                local.get 5
                i32.const 4
                i32.add
                local.set 5
                local.get 4
                i32.const 1
                i32.add
                local.set 4
                local.get 0
                i32.const 4
                i32.add
                local.set 0
                local.get 12
                local.get 3
                i32.lt_s
                br_if 0 (;@6;)
              end
            end
            local.get 1
            local.get 13
            i32.add
            local.set 1
            local.get 2
            local.get 9
            i32.add
            local.set 2
            local.get 7
            i32.const 1
            i32.add
            local.tee 7
            local.get 8
            i32.ne
            br_if 0 (;@4;)
            br 2 (;@2;)
          end
        end
        block  ;; label = @3
          local.get 9
          i32.const 1
          i32.lt_s
          br_if 0 (;@3;)
          local.get 10
          local.set 4
          local.get 9
          local.set 5
          loop  ;; label = @4
            block  ;; label = @5
              local.get 0
              local.get 2
              call $decode_packed_entry_number
              local.tee 12
              i32.const -1
              i32.ne
              br_if 0 (;@5;)
              local.get 6
              global.set $__stack_pointer
              i32.const -1
              return
            end
            local.get 4
            local.get 0
            i32.load offset=16
            local.get 0
            i32.load
            local.tee 8
            local.get 12
            i32.mul
            i32.const 2
            i32.shl
            i32.add
            i32.store
            local.get 4
            i32.const 4
            i32.add
            local.set 4
            local.get 5
            i32.const -1
            i32.add
            local.tee 5
            br_if 0 (;@4;)
          end
        end
        local.get 8
        i32.const 1
        i32.lt_s
        br_if 1 (;@1;)
        local.get 9
        i32.const 2
        i32.shl
        local.set 13
        i32.const 0
        local.set 2
        local.get 9
        i32.const 1
        i32.lt_s
        local.set 14
        i32.const 0
        local.set 7
        loop  ;; label = @3
          block  ;; label = @4
            local.get 14
            br_if 0 (;@4;)
            local.get 2
            local.get 3
            i32.ge_s
            br_if 0 (;@4;)
            i32.const 1
            local.set 4
            local.get 10
            local.set 5
            local.get 1
            local.set 0
            loop  ;; label = @5
              local.get 0
              local.get 0
              i32.load
              local.get 5
              i32.load
              local.get 7
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.get 11
              i32.shr_s
              i32.add
              i32.store
              local.get 4
              local.get 9
              i32.ge_s
              br_if 1 (;@4;)
              local.get 2
              local.get 4
              i32.add
              local.set 12
              local.get 5
              i32.const 4
              i32.add
              local.set 5
              local.get 4
              i32.const 1
              i32.add
              local.set 4
              local.get 0
              i32.const 4
              i32.add
              local.set 0
              local.get 12
              local.get 3
              i32.lt_s
              br_if 0 (;@5;)
            end
          end
          local.get 1
          local.get 13
          i32.add
          local.set 1
          local.get 2
          local.get 9
          i32.add
          local.set 2
          local.get 7
          i32.const 1
          i32.add
          local.tee 7
          local.get 8
          i32.ne
          br_if 0 (;@3;)
        end
      end
      i32.const 0
      local.set 7
    end
    local.get 6
    global.set $__stack_pointer
    local.get 7)
  (func $_01inverse (type 17) (param i32 i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    local.tee 5
    local.set 6
    block  ;; label = @1
      local.get 1
      i32.load
      local.tee 7
      i32.load offset=4
      local.tee 8
      local.get 0
      i32.load offset=36
      i32.const 1
      i32.shr_s
      local.tee 9
      local.get 8
      local.get 9
      i32.lt_s
      select
      local.get 7
      i32.load
      i32.sub
      local.tee 8
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 1
      i32.load offset=20
      i32.load
      local.set 10
      local.get 8
      local.get 7
      i32.load offset=8
      local.tee 11
      i32.div_s
      local.set 12
      local.get 5
      local.get 3
      i32.const 2
      i32.shl
      i32.const 15
      i32.add
      i32.const -16
      i32.and
      i32.sub
      local.tee 13
      global.set $__stack_pointer
      block  ;; label = @2
        local.get 3
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        local.get 10
        local.get 12
        i32.add
        i32.const -1
        i32.add
        local.get 10
        i32.div_s
        i32.const 2
        i32.shl
        i32.const 7
        i32.add
        i32.const -8
        i32.and
        local.set 9
        local.get 0
        i32.load offset=68
        local.set 14
        local.get 0
        i32.load offset=72
        local.set 8
        local.get 13
        local.set 5
        local.get 3
        local.set 15
        loop  ;; label = @3
          block  ;; label = @4
            local.get 8
            local.get 9
            i32.add
            local.get 0
            i32.load offset=76
            i32.le_s
            br_if 0 (;@4;)
            block  ;; label = @5
              local.get 14
              i32.eqz
              br_if 0 (;@5;)
              i32.const 8
              call $malloc
              local.tee 16
              local.get 14
              i32.store
              local.get 0
              i32.load offset=84
              local.set 14
              local.get 0
              local.get 16
              i32.store offset=84
              local.get 16
              local.get 14
              i32.store offset=4
              local.get 0
              local.get 0
              i32.load offset=80
              local.get 8
              i32.add
              i32.store offset=80
            end
            local.get 0
            local.get 9
            i32.store offset=76
            local.get 0
            local.get 9
            call $malloc
            local.tee 14
            i32.store offset=68
            i32.const 0
            local.set 8
          end
          local.get 5
          local.get 14
          local.get 8
          i32.add
          i32.store
          local.get 0
          local.get 8
          local.get 9
          i32.add
          local.tee 8
          i32.store offset=72
          local.get 5
          i32.const 4
          i32.add
          local.set 5
          local.get 15
          i32.const -1
          i32.add
          local.tee 15
          br_if 0 (;@3;)
        end
      end
      local.get 1
      i32.load offset=12
      local.tee 8
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 0
      i32.const 4
      i32.add
      local.set 17
      local.get 12
      i32.const 1
      i32.lt_s
      local.set 18
      i32.const 0
      local.set 19
      loop  ;; label = @2
        block  ;; label = @3
          local.get 18
          br_if 0 (;@3;)
          i32.const 0
          local.set 20
          local.get 19
          i32.const 0
          i32.ne
          local.get 3
          i32.const 1
          i32.lt_s
          local.tee 21
          i32.or
          local.set 22
          i32.const 1
          local.get 19
          i32.shl
          local.set 16
          i32.const 0
          local.set 14
          loop  ;; label = @4
            local.get 3
            local.set 9
            local.get 13
            local.set 8
            block  ;; label = @5
              local.get 22
              br_if 0 (;@5;)
              loop  ;; label = @6
                local.get 1
                i32.load offset=20
                local.tee 0
                i32.load offset=8
                i32.const 1
                i32.lt_s
                br_if 5 (;@1;)
                local.get 0
                local.get 17
                call $decode_packed_entry_number
                local.tee 5
                i32.const 0
                i32.lt_s
                br_if 5 (;@1;)
                local.get 0
                i32.load offset=24
                local.get 5
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.tee 0
                i32.const -1
                i32.eq
                br_if 5 (;@1;)
                local.get 0
                local.get 7
                i32.load offset=16
                i32.ge_s
                br_if 5 (;@1;)
                local.get 8
                i32.load
                local.get 14
                i32.const 2
                i32.shl
                i32.add
                local.get 1
                i32.load offset=32
                local.get 0
                i32.const 2
                i32.shl
                i32.add
                i32.load
                local.tee 0
                i32.store
                local.get 0
                i32.eqz
                br_if 5 (;@1;)
                local.get 8
                i32.const 4
                i32.add
                local.set 8
                local.get 9
                i32.const -1
                i32.add
                local.tee 9
                br_if 0 (;@6;)
              end
            end
            block  ;; label = @5
              local.get 10
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 20
              local.get 12
              i32.ge_s
              br_if 0 (;@5;)
              i32.const 0
              local.set 15
              loop  ;; label = @6
                block  ;; label = @7
                  local.get 21
                  br_if 0 (;@7;)
                  local.get 20
                  local.get 11
                  i32.mul
                  i32.const 2
                  i32.shl
                  local.set 23
                  local.get 13
                  local.set 8
                  local.get 2
                  local.set 0
                  local.get 3
                  local.set 9
                  loop  ;; label = @8
                    block  ;; label = @9
                      local.get 7
                      local.get 8
                      i32.load
                      local.get 14
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      local.get 15
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      i32.const 2
                      i32.shl
                      local.tee 5
                      i32.add
                      i32.const 24
                      i32.add
                      i32.load
                      local.get 16
                      i32.and
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 1
                      i32.load offset=24
                      local.get 5
                      i32.add
                      i32.load
                      local.get 19
                      i32.const 2
                      i32.shl
                      i32.add
                      i32.load
                      local.tee 5
                      i32.eqz
                      br_if 0 (;@9;)
                      local.get 5
                      local.get 0
                      i32.load
                      local.get 7
                      i32.load
                      i32.const 2
                      i32.shl
                      i32.add
                      local.get 23
                      i32.add
                      local.get 17
                      local.get 11
                      i32.const -8
                      local.get 4
                      call_indirect (type 6)
                      i32.const -1
                      i32.eq
                      br_if 8 (;@1;)
                    end
                    local.get 8
                    i32.const 4
                    i32.add
                    local.set 8
                    local.get 0
                    i32.const 4
                    i32.add
                    local.set 0
                    local.get 9
                    i32.const -1
                    i32.add
                    local.tee 9
                    br_if 0 (;@8;)
                  end
                end
                local.get 20
                i32.const 1
                i32.add
                local.set 20
                local.get 15
                i32.const 1
                i32.add
                local.tee 15
                local.get 10
                i32.ge_s
                br_if 1 (;@5;)
                local.get 20
                local.get 12
                i32.lt_s
                br_if 0 (;@6;)
              end
            end
            local.get 14
            i32.const 1
            i32.add
            local.set 14
            local.get 20
            local.get 12
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 1
          i32.load offset=12
          local.set 8
        end
        local.get 19
        i32.const 1
        i32.add
        local.tee 19
        local.get 8
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    local.get 6
    global.set $__stack_pointer)
  (func $res1_inverse (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 4
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      i32.const 0
      local.set 5
      i32.const 0
      local.set 6
      block  ;; label = @2
        block  ;; label = @3
          local.get 4
          i32.const 1
          i32.eq
          br_if 0 (;@3;)
          local.get 4
          i32.const 1
          i32.and
          local.set 7
          local.get 4
          i32.const 2147483646
          i32.and
          local.set 8
          i32.const 0
          local.set 6
          local.get 3
          local.set 4
          local.get 2
          local.set 9
          i32.const 0
          local.set 5
          loop  ;; label = @4
            block  ;; label = @5
              local.get 4
              i32.load
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              local.get 6
              i32.const 2
              i32.shl
              i32.add
              local.get 9
              i32.load
              i32.store
              local.get 6
              i32.const 1
              i32.add
              local.set 6
            end
            block  ;; label = @5
              local.get 4
              i32.const 4
              i32.add
              i32.load
              i32.eqz
              br_if 0 (;@5;)
              local.get 2
              local.get 6
              i32.const 2
              i32.shl
              i32.add
              local.get 9
              i32.const 4
              i32.add
              i32.load
              i32.store
              local.get 6
              i32.const 1
              i32.add
              local.set 6
            end
            local.get 4
            i32.const 8
            i32.add
            local.set 4
            local.get 9
            i32.const 8
            i32.add
            local.set 9
            local.get 8
            local.get 5
            i32.const 2
            i32.add
            local.tee 5
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 7
          i32.eqz
          br_if 1 (;@2;)
        end
        local.get 3
        local.get 5
        i32.const 2
        i32.shl
        local.tee 4
        i32.add
        i32.load
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        local.get 6
        i32.const 2
        i32.shl
        i32.add
        local.get 2
        local.get 4
        i32.add
        i32.load
        i32.store
        local.get 6
        i32.const 1
        i32.add
        local.set 6
      end
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      local.get 1
      local.get 2
      local.get 6
      i32.const 6
      call $_01inverse
    end
    i32.const 0)
  (func $vorbis_book_decodev_add (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32)
    i32.const 0
    local.set 5
    block  ;; label = @1
      local.get 0
      i32.load offset=8
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      block  ;; label = @2
        block  ;; label = @3
          local.get 4
          local.get 0
          i32.load offset=12
          i32.sub
          local.tee 6
          i32.const -1
          i32.gt_s
          br_if 0 (;@3;)
          local.get 3
          i32.const 1
          i32.lt_s
          br_if 2 (;@1;)
          i32.const 0
          local.set 7
          i32.const 0
          local.get 6
          i32.sub
          local.set 6
          i32.const -1
          local.set 5
          loop  ;; label = @4
            local.get 0
            local.get 2
            call $decode_packed_entry_number
            local.tee 4
            i32.const -1
            i32.eq
            br_if 3 (;@1;)
            block  ;; label = @5
              local.get 7
              local.get 3
              i32.ge_s
              br_if 0 (;@5;)
              local.get 0
              i32.load
              local.tee 8
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 0
              i32.load offset=16
              local.get 8
              local.get 4
              i32.mul
              i32.const 2
              i32.shl
              i32.add
              local.set 9
              local.get 1
              local.get 7
              i32.const 2
              i32.shl
              i32.add
              local.set 4
              i32.const 1
              local.set 10
              block  ;; label = @6
                loop  ;; label = @7
                  local.get 4
                  local.get 4
                  i32.load
                  local.get 9
                  i32.load
                  local.get 6
                  i32.shl
                  i32.add
                  i32.store
                  local.get 10
                  i32.const 1
                  i32.add
                  local.set 11
                  local.get 7
                  local.get 10
                  i32.add
                  local.get 3
                  i32.ge_s
                  br_if 1 (;@6;)
                  local.get 4
                  i32.const 4
                  i32.add
                  local.set 4
                  local.get 9
                  i32.const 4
                  i32.add
                  local.set 9
                  local.get 10
                  local.get 8
                  i32.lt_s
                  local.set 12
                  local.get 11
                  local.set 10
                  local.get 12
                  br_if 0 (;@7;)
                end
              end
              local.get 7
              local.get 11
              i32.add
              i32.const -1
              i32.add
              local.set 7
            end
            local.get 7
            local.get 3
            i32.lt_s
            br_if 0 (;@4;)
            br 2 (;@2;)
          end
        end
        local.get 3
        i32.const 1
        i32.lt_s
        br_if 1 (;@1;)
        i32.const 0
        local.set 7
        i32.const -1
        local.set 5
        loop  ;; label = @3
          local.get 0
          local.get 2
          call $decode_packed_entry_number
          local.tee 4
          i32.const -1
          i32.eq
          br_if 2 (;@1;)
          block  ;; label = @4
            local.get 7
            local.get 3
            i32.ge_s
            br_if 0 (;@4;)
            local.get 0
            i32.load
            local.tee 8
            i32.const 1
            i32.lt_s
            br_if 0 (;@4;)
            local.get 0
            i32.load offset=16
            local.get 8
            local.get 4
            i32.mul
            i32.const 2
            i32.shl
            i32.add
            local.set 9
            local.get 1
            local.get 7
            i32.const 2
            i32.shl
            i32.add
            local.set 4
            i32.const 1
            local.set 10
            block  ;; label = @5
              loop  ;; label = @6
                local.get 4
                local.get 4
                i32.load
                local.get 9
                i32.load
                local.get 6
                i32.shr_s
                i32.add
                i32.store
                local.get 10
                i32.const 1
                i32.add
                local.set 11
                local.get 7
                local.get 10
                i32.add
                local.get 3
                i32.ge_s
                br_if 1 (;@5;)
                local.get 4
                i32.const 4
                i32.add
                local.set 4
                local.get 9
                i32.const 4
                i32.add
                local.set 9
                local.get 10
                local.get 8
                i32.lt_s
                local.set 12
                local.get 11
                local.set 10
                local.get 12
                br_if 0 (;@6;)
              end
            end
            local.get 7
            local.get 11
            i32.add
            i32.const -1
            i32.add
            local.set 7
          end
          local.get 7
          local.get 3
          i32.lt_s
          br_if 0 (;@3;)
        end
      end
      i32.const 0
      local.set 5
    end
    local.get 5)
  (func $res2_inverse (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 1
      i32.load
      local.tee 5
      i32.load offset=4
      local.tee 6
      local.get 0
      i32.load offset=36
      local.get 4
      i32.mul
      i32.const 1
      i32.shr_s
      local.tee 7
      local.get 6
      local.get 7
      i32.lt_s
      select
      local.get 5
      i32.load
      local.tee 6
      i32.sub
      local.tee 8
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 0
      i32.load offset=68
      local.set 9
      block  ;; label = @2
        local.get 0
        i32.load offset=72
        local.tee 7
        local.get 1
        i32.load offset=20
        i32.load
        local.tee 10
        local.get 8
        local.get 5
        i32.load offset=8
        local.tee 11
        i32.div_s
        local.tee 12
        i32.add
        i32.const -1
        i32.add
        local.get 10
        i32.div_s
        i32.const 2
        i32.shl
        i32.const 7
        i32.add
        i32.const -8
        i32.and
        local.tee 8
        i32.add
        local.get 0
        i32.load offset=76
        i32.le_s
        br_if 0 (;@2;)
        block  ;; label = @3
          local.get 9
          i32.eqz
          br_if 0 (;@3;)
          i32.const 8
          call $malloc
          local.tee 6
          local.get 9
          i32.store
          local.get 0
          i32.load offset=84
          local.set 9
          local.get 0
          local.get 6
          i32.store offset=84
          local.get 6
          local.get 9
          i32.store offset=4
          local.get 0
          local.get 0
          i32.load offset=80
          local.get 7
          i32.add
          i32.store offset=80
        end
        local.get 0
        local.get 8
        i32.store offset=76
        local.get 0
        local.get 8
        call $malloc
        local.tee 9
        i32.store offset=68
        local.get 5
        i32.load
        local.set 6
        i32.const 0
        local.set 7
      end
      local.get 0
      local.get 7
      local.get 8
      i32.add
      i32.store offset=72
      local.get 6
      local.get 4
      i32.div_s
      local.set 13
      i32.const 0
      local.set 6
      block  ;; label = @2
        local.get 4
        i32.const 1
        i32.lt_s
        br_if 0 (;@2;)
        loop  ;; label = @3
          local.get 3
          i32.load
          br_if 1 (;@2;)
          local.get 3
          i32.const 4
          i32.add
          local.set 3
          local.get 4
          local.get 6
          i32.const 1
          i32.add
          local.tee 6
          i32.eq
          br_if 2 (;@1;)
          br 0 (;@3;)
        end
      end
      local.get 6
      local.get 4
      i32.eq
      br_if 0 (;@1;)
      local.get 11
      local.get 4
      i32.div_s
      local.set 14
      local.get 1
      i32.load offset=12
      local.tee 3
      i32.const 1
      i32.lt_s
      br_if 0 (;@1;)
      local.get 9
      local.get 7
      i32.add
      local.set 15
      local.get 0
      i32.const 4
      i32.add
      local.set 16
      local.get 12
      i32.const 1
      i32.lt_s
      local.set 17
      i32.const 0
      local.set 18
      loop  ;; label = @2
        block  ;; label = @3
          local.get 17
          br_if 0 (;@3;)
          i32.const 1
          local.get 18
          i32.shl
          local.set 19
          i32.const 0
          local.set 20
          i32.const 0
          local.set 21
          loop  ;; label = @4
            block  ;; label = @5
              local.get 18
              br_if 0 (;@5;)
              local.get 1
              i32.load offset=20
              local.tee 3
              i32.load offset=8
              i32.const 1
              i32.lt_s
              br_if 4 (;@1;)
              local.get 3
              local.get 16
              call $decode_packed_entry_number
              local.tee 6
              i32.const 0
              i32.lt_s
              br_if 4 (;@1;)
              local.get 3
              i32.load offset=24
              local.get 6
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.tee 3
              i32.const -1
              i32.eq
              br_if 4 (;@1;)
              local.get 3
              local.get 5
              i32.load offset=16
              i32.ge_s
              br_if 4 (;@1;)
              local.get 15
              local.get 21
              i32.const 2
              i32.shl
              i32.add
              local.get 1
              i32.load offset=32
              local.get 3
              i32.const 2
              i32.shl
              i32.add
              i32.load
              local.tee 3
              i32.store
              local.get 3
              i32.eqz
              br_if 4 (;@1;)
            end
            block  ;; label = @5
              local.get 10
              i32.const 1
              i32.lt_s
              br_if 0 (;@5;)
              local.get 20
              local.get 12
              i32.ge_s
              br_if 0 (;@5;)
              local.get 15
              local.get 21
              i32.const 2
              i32.shl
              i32.add
              local.set 22
              i32.const 0
              local.set 23
              loop  ;; label = @6
                block  ;; label = @7
                  local.get 5
                  local.get 22
                  i32.load
                  local.get 23
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  i32.const 2
                  i32.shl
                  local.tee 3
                  i32.add
                  i32.const 24
                  i32.add
                  i32.load
                  local.get 19
                  i32.and
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 1
                  i32.load offset=24
                  local.get 3
                  i32.add
                  i32.load
                  local.get 18
                  i32.const 2
                  i32.shl
                  i32.add
                  i32.load
                  local.tee 24
                  i32.eqz
                  br_if 0 (;@7;)
                  local.get 24
                  i32.load offset=8
                  i32.const 1
                  i32.lt_s
                  br_if 0 (;@7;)
                  local.get 14
                  local.get 20
                  local.get 14
                  i32.mul
                  local.get 13
                  i32.add
                  local.tee 3
                  i32.add
                  local.set 9
                  block  ;; label = @8
                    block  ;; label = @9
                      i32.const -8
                      local.get 24
                      i32.load offset=12
                      local.tee 6
                      i32.sub
                      local.tee 25
                      i32.const -1
                      i32.gt_s
                      br_if 0 (;@9;)
                      local.get 9
                      local.get 3
                      i32.le_s
                      br_if 2 (;@7;)
                      local.get 6
                      i32.const 8
                      i32.add
                      local.set 25
                      i32.const 0
                      local.set 6
                      br 1 (;@8;)
                    end
                    local.get 9
                    local.get 3
                    i32.le_s
                    br_if 1 (;@7;)
                    i32.const 0
                    local.set 6
                    loop  ;; label = @9
                      local.get 24
                      local.get 16
                      call $decode_packed_entry_number
                      local.tee 0
                      i32.const -1
                      i32.eq
                      br_if 8 (;@1;)
                      block  ;; label = @10
                        local.get 3
                        local.get 9
                        i32.ge_s
                        br_if 0 (;@10;)
                        local.get 24
                        i32.load
                        local.tee 11
                        i32.const 1
                        i32.lt_s
                        br_if 0 (;@10;)
                        local.get 24
                        i32.load offset=16
                        local.get 11
                        local.get 0
                        i32.mul
                        i32.const 2
                        i32.shl
                        i32.add
                        local.set 0
                        i32.const 1
                        local.set 7
                        loop  ;; label = @11
                          local.get 2
                          local.get 6
                          i32.const 2
                          i32.shl
                          i32.add
                          i32.load
                          local.get 3
                          i32.const 2
                          i32.shl
                          i32.add
                          local.tee 8
                          local.get 8
                          i32.load
                          local.get 0
                          i32.load
                          local.get 25
                          i32.shr_s
                          i32.add
                          i32.store
                          i32.const 0
                          local.get 6
                          i32.const 1
                          i32.add
                          local.tee 6
                          local.get 6
                          local.get 4
                          i32.eq
                          local.tee 8
                          select
                          local.set 6
                          local.get 3
                          local.get 8
                          i32.add
                          local.tee 3
                          local.get 9
                          i32.ge_s
                          br_if 1 (;@10;)
                          local.get 0
                          i32.const 4
                          i32.add
                          local.set 0
                          local.get 7
                          local.get 11
                          i32.lt_s
                          local.set 8
                          local.get 7
                          i32.const 1
                          i32.add
                          local.set 7
                          local.get 8
                          br_if 0 (;@11;)
                        end
                      end
                      local.get 3
                      local.get 9
                      i32.ge_s
                      br_if 2 (;@7;)
                      br 0 (;@9;)
                    end
                  end
                  loop  ;; label = @8
                    local.get 24
                    local.get 16
                    call $decode_packed_entry_number
                    local.tee 0
                    i32.const -1
                    i32.eq
                    br_if 7 (;@1;)
                    block  ;; label = @9
                      local.get 3
                      local.get 9
                      i32.ge_s
                      br_if 0 (;@9;)
                      local.get 24
                      i32.load
                      local.tee 11
                      i32.const 1
                      i32.lt_s
                      br_if 0 (;@9;)
                      local.get 24
                      i32.load offset=16
                      local.get 11
                      local.get 0
                      i32.mul
                      i32.const 2
                      i32.shl
                      i32.add
                      local.set 0
                      i32.const 1
                      local.set 7
                      loop  ;; label = @10
                        local.get 2
                        local.get 6
                        i32.const 2
                        i32.shl
                        i32.add
                        i32.load
                        local.get 3
                        i32.const 2
                        i32.shl
                        i32.add
                        local.tee 8
                        local.get 8
                        i32.load
                        local.get 0
                        i32.load
                        local.get 25
                        i32.shl
                        i32.add
                        i32.store
                        i32.const 0
                        local.get 6
                        i32.const 1
                        i32.add
                        local.tee 6
                        local.get 6
                        local.get 4
                        i32.eq
                        local.tee 8
                        select
                        local.set 6
                        local.get 3
                        local.get 8
                        i32.add
                        local.tee 3
                        local.get 9
                        i32.ge_s
                        br_if 1 (;@9;)
                        local.get 0
                        i32.const 4
                        i32.add
                        local.set 0
                        local.get 7
                        local.get 11
                        i32.lt_s
                        local.set 8
                        local.get 7
                        i32.const 1
                        i32.add
                        local.set 7
                        local.get 8
                        br_if 0 (;@10;)
                      end
                    end
                    local.get 3
                    local.get 9
                    i32.lt_s
                    br_if 0 (;@8;)
                  end
                end
                local.get 20
                i32.const 1
                i32.add
                local.set 20
                local.get 23
                i32.const 1
                i32.add
                local.tee 23
                local.get 10
                i32.ge_s
                br_if 1 (;@5;)
                local.get 20
                local.get 12
                i32.lt_s
                br_if 0 (;@6;)
              end
            end
            local.get 21
            i32.const 1
            i32.add
            local.set 21
            local.get 20
            local.get 12
            i32.lt_s
            br_if 0 (;@4;)
          end
          local.get 1
          i32.load offset=12
          local.set 3
        end
        local.get 18
        i32.const 1
        i32.add
        local.tee 18
        local.get 3
        i32.lt_s
        br_if 0 (;@2;)
      end
    end
    i32.const 0)
  (func $sharedbook_sort32a (type 5) (param i32 i32) (result i32)
    local.get 0
    i32.load
    i32.load
    local.tee 0
    local.get 1
    i32.load
    i32.load
    local.tee 1
    i32.gt_u
    local.get 0
    local.get 1
    i32.lt_u
    i32.sub)
  (func $__init_random_seed (type 7)
    (local i32 i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 0
    global.set $__stack_pointer
    local.get 0
    i32.const 12
    i32.add
    i32.const 4
    call $wasi_random_get
    local.set 1
    i32.const 0
    i32.const 16799528
    i32.const 1103515245
    i32.mul
    local.get 0
    i32.load offset=12
    local.get 1
    i32.const 65535
    i32.and
    select
    i32.store offset=16799528
    local.get 0
    i32.const 16
    i32.add
    global.set $__stack_pointer)
  (table (;0;) 28 28 funcref)
  (memory (;0;) 257)
  (global $__stack_pointer (mut i32) (i32.const 16777216))
  (export "memory" (memory 0))
  (export "_initialize" (func $_initialize))
  (export "malloc" (func $malloc))
  (export "free" (func $free))
  (export "decode" (func $decode))
  (export "release" (func $release))
  (elem (;0;) (i32.const 1) func $mem_seek $mem_read $sharedbook_sort32a $floor1_icomp $vorbis_book_decodevs_add $vorbis_book_decodev_add $mem_close $mem_tell $floor0_unpack $floor0_look $floor0_free_info $floor0_free_look $floor0_inverse1 $floor0_inverse2 $floor1_unpack $floor1_look $floor1_free_info $floor1_free_look $floor1_inverse1 $floor1_inverse2 $res0_unpack $res0_look $res0_free_info $res0_free_look $res0_inverse $res1_inverse $res2_inverse)
  (data (;0;) (i32.const 16777216) "\02\00\00\00\01\00\00\00\07\00\00\00\08\00\00\00\00\ff\00\ff\01\ff\01\ff\02\ff\02\ff\02\ff\03\ff\03\ff\04\ff\04\ff\04\ff\05\ff\05\ff\05\ff\06\ff\06\ff\07\ff\07\ff\07\ff\08\ff\08\ff\09\ff\09\ff\09\ff\0a\ff\0a\ff\0b\ff\0b\ff\0b\ff\0c\ff\0c\ff\0d\ff\0d\ff\0d\ff\0e\ff\0e\ff\0f\ff\0f\ff\0f\ff\10\ff\10\ff\10\ff\11\ff\11\ff\12\ff\12\ff\12\ff\13\ff\13\ff\14\ff\14\ff\14\ff\15\ff\15\ff\16\ff\16\ff\16\ff\17\ff\17\ff\18\ff\18\ff\18\ff\19\ff\19\ff\19\ff\1a\ff\1a\ff\1b\ff\1b\ff\1b\ff\1c\fe\1c\fe\1d\fe\1d\fe\1d\fe\1e\fe\1e\fe\1f\fe\1f\fe\1f\fe \fe \fe!\fe!\fe!\fe\22\fe\22\fe\22\fe#\fe#\fe$\fe$\fd$\fd%\fd%\fd&\fd&\fd&\fd'\fd'\fd(\fd(\fd(\fd)\fd)\fd)\fd*\fd*\fc+\fc+\fc+\fc,\fc,\fc-\fc-\fc-\fc.\fc.\fc.\fc/\fc/\fc0\fc0\fb0\fb1\fb1\fb2\fb2\fb2\fb3\fb3\fb3\fb4\fb4\fb5\fb5\fa5\fa6\fa6\fa7\fa7\fa7\fa8\fa8\fa8\fa9\fa9\fa:\f9:\f9:\f9;\f9;\f9<\f9<\f9<\f9=\f9=\f9=\f9>\f8>\f8?\f8?\f8?\f8@\f8@\f8@\f8A\f8A\f8B\f7B\f7B\f7C\f7C\f7D\f7D\f7D\f7E\f7E\f7E\f6F\f6F\f6G\f6G\f6G\f6H\f6H\f6H\f6I\f5I\f5J\f5J\f5J\f5K\f5K\f5K\f5L\f5L\f4M\f4M\f4M\f4N\f4N\f4N\f4O\f4O\f3P\f3P\f3P\f3Q\f3Q\f3Q\f3R\f3R\f2S\f2S\f2S\f2T\f2T\f2T\f2U\f2U\f1V\f1V\f1V\f1W\f1W\f1W\f1X\f1X\f0X\f0Y\f0Y\f0Z\f0Z\f0Z\f0[\ef[\ef[\ef\5c\ef\5c\ef\5c\ef]\ef]\ee^\ee^\ee^\ee_\ee_\ee_\ee`\ed`\eda\eda\eda\edb\edb\edb\ecc\ecc\ecc\ecd\ecd\ece\ebe\ebe\ebf\ebf\ebf\ebg\ebg\eag\eah\eah\eah\eai\eai\e9j\e9j\e9j\e9k\e9k\e9k\e8l\e8l\e8l\e8m\e8m\e8m\e7n\e7n\e7o\e7o\e7o\e7p\e6p\e6p\e6q\e6q\e6q\e6r\e5r\e5r\e5s\e5s\e5s\e4t\e4t\e4u\e4u\e4u\e4v\e3v\e3v\e3w\e3w\e3w\e3x\e2x\e2x\e2y\e2y\e2y\e1z\e1z\e1z\e1{\e1{\e0{\e0|\e0|\e0|\e0}\e0}\df}\df~\df~\df\7f\df\7f\de\7f\de\80\de\80\de\80\de\81\dd\81\dd\81\dd\82\dd\82\dd\82\dc\83\dc\83\dc\83\dc\84\dc\84\db\84\db\85\db\85\db\85\db\86\da\86\da\86\da\87\da\87\da\87\d9\88\d9\88\d9\88\d9\89\d8\89\d8\89\d8\8a\d8\8a\d8\8a\d7\8b\d7\8b\d7\8b\d7\8c\d7\8c\d6\8c\d6\8d\d6\8d\d6\8d\d6\8e\d5\8e\d5\8e\d5\8f\d5\8f\d4\8f\d4\90\d4\90\d4\90\d4\91\d3\91\d3\91\d3\91\d3\92\d2\92\d2\92\d2\93\d2\93\d2\93\d1\94\d1\94\d1\94\d1\95\d0\95\d0\95\d0\96\d0\96\cf\96\cf\97\cf\97\cf\97\cf\98\ce\98\ce\98\ce\98\ce\99\cd\99\cd\99\cd\9a\cd\9a\cc\9a\cc\9b\cc\9b\cc\9b\cb\9c\cb\9c\cb\9c\cb\9d\cb\9d\ca\9d\ca\9d\ca\9e\ca\9e\c9\9e\c9\9f\c9\9f\c9\9f\c8\a0\c8\a0\c8\a0\c8\a1\c7\a1\c7\a1\c7\a1\c7\a2\c6\a2\c6\a2\c6\a3\c6\a3\c5\a3\c5\a4\c5\a4\c5\a4\c4\a5\c4\a5\c4\a5\c4\a5\c3\a6\c3\a6\c3\a6\c3\a7\c2\a7\c2\a7\c2\a8\c2\a8\c1\a8\c1\a8\c1\a9\c1\a9\c0\a9\c0\aa\c0\aa\c0\aa\bf\aa\bf\ab\bf\ab\be\ab\be\ac\be\ac\be\ac\bd\ad\bd\ad\bd\ad\bd\ad\bc\ae\bc\ae\bc\ae\bc\af\bb\af\bb\af\bb\af\ba\b0\ba\b0\ba\b0\ba\b1\b9\b1\b9\b1\b9\b1\b9\b2\b8\b2\b8\b2\b8\b3\b8\b3\b7\b3\b7\b3\b7\b4\b6\b4\b6\b4\b6\b4\b6\b5\b5\b5\b5\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\ff\01\ff\01\ff\01\ff\02\ff\02\ff\03\ff\03\ff\03\ff\04\ff\04\ff\05\ff\05\ff\05\ff\06\ff\06\ff\06\ff\07\ff\07\ff\08\ff\08\ff\08\ff\09\ff\09\ff\0a\ff\0a\ff\0a\ff\0b\ff\0b\ff\0c\ff\0c\ff\0c\ff\0d\ff\0d\ff\0e\ff\0e\ff\0e\ff\0f\ff\0f\ff\10\ff\10\ff\10\ff\11\ff\11\ff\11\ff\12\ff\12\ff\13\ff\13\ff\13\ff\14\ff\14\ff\15\ff\15\ff\15\ff\16\ff\16\ff\17\ff\17\ff\17\ff\18\ff\18\ff\19\ff\19\ff\19\ff\1a\ff\1a\ff\1a\ff\1b\ff\1b\ff\1c\ff\1c\fe\1c\fe\1d\fe\1d\fe\1e\fe\1e\fe\1e\fe\1f\fe\1f\fe \fe \fe \fe!\fe!\fe!\fe\22\fe\22\fe#\fe#\fe#\fe$\fd$\fd%\fd%\fd%\fd&\fd&\fd'\fd'\fd'\fd(\fd(\fd(\fd)\fd)\fd*\fd*\fd*\fc+\fc+\fc,\fc,\fc,\fc-\fc-\fc.\fc.\fc.\fc/\fc/\fc/\fc0\fb0\fb1\fb1\fb1\fb2\fb2\fb3\fb3\fb3\fb4\fb4\fb4\fb5\fa5\fa6\fa6\fa6\fa7\fa7\fa8\fa8\fa8\fa9\fa9\fa9\f9:\f9:\f9;\f9;\f9;\f9<\f9<\f9<\f9=\f9=\f9>\f8>\f8>\f8?\f8?\f8@\f8@\f8@\f8A\f8A\f8A\f7B\f7B\f7C\f7C\f7C\f7D\f7D\f7D\f7E\f7E\f6F\f6F\f6F\f6G\f6G\f6G\f6H\f6H\f6I\f5I\f5I\f5J\f5J\f5K\f5K\f5K\f5L\f5L\f4L\f4M\f4M\f4N\f4N\f4N\f4O\f4O\f4O\f3P\f3P\f3P\f3Q\f3Q\f3R\f3R\f3R\f2S\f2S\f2S\f2T\f2T\f2U\f2U\f1U\f1V\f1V\f1V\f1W\f1W\f1X\f1X\f0X\f0Y\f0Y\f0Y\f0Z\f0Z\f0Z\ef[\ef[\ef\5c\ef\5c\ef\5c\ef]\ef]\ee]\ee^\ee^\ee_\ee_\ee_\ee`\ed`\ed`\eda\eda\eda\edb\edb\ecc\ecc\ecc\ecd\ecd\ecd\ece\ebe\ebe\ebf\ebf\ebf\ebg\eag\eah\eah\eah\eai\eai\e9i\e9j\e9j\e9j\e9k\e9k\e9k\e8l\e8l\e8m\e8m\e8m\e8n\e7n\e7n\e7o\e7o\e7o\e6p\e6p\e6p\e6q\e6q\e6r\e5r\e5r\e5s\e5s\e5s\e5t\e4t\e4t\e4u\e4u\e4u\e4v\e3v\e3v\e3w\e3w\e3w\e2x\e2x\e2y\e2y\e2y\e1z\e1z\e1z\e1{\e1{\e1{\e0|\e0|\e0|\e0}\e0}\df}\df~\df~\df~\df\7f\de\7f\de\7f\de\80\de\80\de\80\dd\81\dd\81\dd\81\dd\82\dd\82\dc\82\dc\83\dc\83\dc\83\dc\84\db\84\db\84\db\85\db\85\db\85\da\86\da\86\da\86\da\87\da\87\d9\87\d9\88\d9\88\d9\88\d9\89\d8\89\d8\89\d8\8a\d8\8a\d8\8a\d7\8b\d7\8b\d7\8b\d7\8c\d6\8c\d6\8c\d6\8d\d6\8d\d6\8d\d5\8e\d5\8e\d5\8e\d5\8f\d5\8f\d4\8f\d4\90\d4\90\d4\90\d3\91\d3\91\d3\91\d3\92\d3\92\d2\92\d2\93\d2\93\d2\93\d1\94\d1\94\d1\94\d1\95\d1\95\d0\95\d0\95\d0\96\d0\96\cf\96\cf\97\cf\97\cf\97\ce\98\ce\98\ce\98\ce\99\ce\99\cd\99\cd\9a\cd\9a\cd\9a\cc\9b\cc\9b\cc\9b\cc\9b\cb\9c\cb\9c\cb\9c\cb\9d\ca\9d\ca\9d\ca\9e\ca\9e\c9\9e\c9\9f\c9\9f\c9\9f\c8\a0\c8\a0\c8\a0\c8\a0\c8\a1\c7\a1\c7\a1\c7\a2\c7\a2\c6\a2\c6\a3\c6\a3\c6\a3\c5\a3\c5\a4\c5\a4\c5\a4\c4\a5\c4\a5\c4\a5\c4\a6\c3\a6\c3\a6\c3\a6\c2\a7\c2\a7\c2\a7\c2\a8\c1\a8\c1\a8\c1\a9\c1\a9\c0\a9\c0\a9\c0\aa\c0\aa\bf\aa\bf\ab\bf\ab\bf\ab\be\ab\be\ac\be\ac\be\ac\bd\ad\bd\ad\bd\ad\bc\ae\bc\ae\bc\ae\bc\ae\bb\af\bb\af\bb\af\bb\b0\ba\b0\ba\b0\ba\b0\ba\b1\b9\b1\b9\b1\b9\b2\b8\b2\b8\b2\b8\b2\b8\b3\b7\b3\b7\b3\b7\b3\b7\b4\b6\b4\b6\b4\b6\b5\b5\b5\b5\00\08\04\0c\02\0a\06\0e\01\09\05\0d\03\0b\07\0f\00\02\06\0c\13\1d'4AP_o\7f\8f\9f\ae\bc\c9\d4\de\e7\ee\f3\f8\fb\fd\fe\ff\ff\ff\ff\ff\00\01\02\03\05\07\0a\0d\11\15\1a\1f%*17>ELT[cks{\83\8b\93\9b\a3\aa\b1\b8\bf\c6\cc\d1\d7\dc\e0\e5\e8\ec\ef\f2\f4\f7\f8\fa\fb\fc\fd\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\01\01\02\03\03\04\05\07\08\09\0b\0d\0e\10\12\14\17\19\1b\1e #&),/259<@CGJNRVY]aeimquy}\81\85\89\8d\91\95\99\9d\a1\a5\a8\ac\b0\b3\b7\ba\be\c1\c4\c7\ca\cd\d0\d3\d5\d8\da\dd\df\e1\e4\e6\e8\e9\eb\ed\ee\f0\f1\f3\f4\f5\f6\f7\f8\f9\fa\fa\fb\fc\fc\fd\fd\fe\fe\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00\01\01\01\01\02\02\02\03\03\04\04\05\05\06\06\07\08\08\09\0a\0b\0b\0c\0d\0e\0f\10\11\12\13\14\15\16\17\18\19\1b\1c\1d\1e !\22$%'(*+-.013568:;=?@BDFHIKMOQSUWYZ\5c^`bdfhjlnprtvxz|~\80\82\84\86\88\8a\8c\8e\90\92\94\96\98\9a\9c\9e\a0\a2\a4\a6\a7\a9\ab\ad\af\b1\b2\b4\b6\b8\b9\bb\bd\be\c0\c2\c3\c5\c6\c8\c9\cb\cc\ce\cf\d1\d2\d3\d5\d6\d7\d9\da\db\dc\dd\df\e0\e1\e2\e3\e4\e5\e6\e7\e8\e9\ea\eb\ec\ec\ed\ee\ef\ef\f0\f1\f2\f2\f3\f4\f4\f5\f5\f6\f6\f7\f7\f8\f8\f9\f9\f9\fa\fa\fb\fb\fb\fc\fc\fc\fc\fd\fd\fd\fd\fd\fe\fe\fe\fe\fe\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\01\02\02\02\02\02\02\03\03\03\03\04\04\04\04\04\05\05\05\06\06\06\06\07\07\07\08\08\08\09\09\0a\0a\0a\0b\0b\0c\0c\0c\0d\0d\0e\0e\0f\0f\10\10\10\11\11\12\13\13\14\14\15\15\16\16\17\17\18\19\19\1a\1a\1b\1c\1c\1d\1d\1e\1f\1f !!\22#$$%&&'())*++,-.//012334567789:;<==>?@ABCDDEFGHIJKLMNOOPQRSTUVWXYZ[\5c]^_`abcdefghijklmnopqrstuvwxyz{|}~\7f\80\81\82\83\84\85\86\87\88\89\8a\8b\8c\8d\8e\8f\90\91\92\93\94\95\96\97\98\99\9a\9b\9c\9d\9e\9f\9f\a0\a1\a2\a3\a4\a5\a6\a7\a8\a9\aa\ab\ac\ad\ad\ae\af\b0\b1\b2\b3\b4\b5\b5\b6\b7\b8\b9\ba\bb\bb\bc\bd\be\bf\c0\c0\c1\c2\c3\c4\c4\c5\c6\c7\c7\c8\c9\ca\cb\cb\cc\cd\cd\ce\cf\d0\d0\d1\d2\d2\d3\d4\d4\d5\d6\d6\d7\d8\d8\d9\da\da\db\db\dc\dd\dd\de\de\df\df\e0\e1\e1\e2\e2\e3\e3\e4\e4\e5\e5\e6\e6\e7\e7\e8\e8\e9\e9\ea\ea\ea\eb\eb\ec\ec\ed\ed\ed\ee\ee\ef\ef\ef\f0\f0\f0\f1\f1\f1\f2\f2\f2\f3\f3\f3\f4\f4\f4\f5\f5\f5\f5\f6\f6\f6\f6\f7\f7\f7\f7\f8\f8\f8\f8\f9\f9\f9\f9\f9\fa\fa\fa\fa\fa\fa\fb\fb\fb\fb\fb\fb\fc\fc\fc\fc\fc\fc\fc\fd\fd\fd\fd\fd\fd\fd\fd\fd\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\06\06\06\06\06\06\06\07\07\07\07\07\07\08\08\08\08\08\08\09\09\09\09\09\09\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0d\0d\0d\0d\0e\0e\0e\0e\0e\0f\0f\0f\0f\10\10\10\10\11\11\11\11\12\12\12\12\13\13\13\13\14\14\14\14\15\15\15\16\16\16\16\17\17\17\18\18\18\18\19\19\19\1a\1a\1a\1b\1b\1b\1b\1c\1c\1c\1d\1d\1d\1e\1e\1e\1f\1f\1f   !!!\22\22\22###$$$%%%&&'''((()))**+++,,,--...//0001122233444556667788899::;;;<<==>>>??@@AABBBCCDDEEFFFGGHHIIJJKKKLLMMNNOOPPQQRRSSSTTUUVVWWXXYYZZ[[\5c\5c]]^^__``aabbccddeeffgghhiiijjkkllmnnooppqqrrssttuuvvwwxxyyzz{{||}}~~\7f\7f\80\80\81\81\82\82\83\83\84\84\85\85\86\86\87\87\88\88\89\89\8a\8a\8b\8b\8c\8c\8d\8d\8e\8e\8f\8f\90\90\91\91\92\92\93\93\94\94\95\95\96\96\97\97\98\98\98\99\99\9a\9a\9b\9b\9c\9c\9d\9d\9e\9e\9f\9f\a0\a0\a1\a1\a2\a2\a3\a3\a4\a4\a4\a5\a5\a6\a6\a7\a7\a8\a8\a9\a9\aa\aa\aa\ab\ab\ac\ac\ad\ad\ae\ae\af\af\af\b0\b0\b1\b1\b2\b2\b3\b3\b3\b4\b4\b5\b5\b6\b6\b7\b7\b7\b8\b8\b9\b9\ba\ba\ba\bb\bb\bc\bc\bc\bd\bd\be\be\bf\bf\bf\c0\c0\c1\c1\c1\c2\c2\c3\c3\c3\c4\c4\c5\c5\c5\c6\c6\c7\c7\c7\c8\c8\c8\c9\c9\ca\ca\ca\cb\cb\cb\cc\cc\cd\cd\cd\ce\ce\ce\cf\cf\cf\d0\d0\d0\d1\d1\d2\d2\d2\d3\d3\d3\d4\d4\d4\d5\d5\d5\d6\d6\d6\d7\d7\d7\d8\d8\d8\d8\d9\d9\d9\da\da\da\db\db\db\dc\dc\dc\dc\dd\dd\dd\de\de\de\de\df\df\df\e0\e0\e0\e0\e1\e1\e1\e2\e2\e2\e2\e3\e3\e3\e3\e4\e4\e4\e4\e5\e5\e5\e5\e6\e6\e6\e6\e7\e7\e7\e7\e8\e8\e8\e8\e9\e9\e9\e9\e9\ea\ea\ea\ea\eb\eb\eb\eb\eb\ec\ec\ec\ec\ec\ed\ed\ed\ed\ed\ee\ee\ee\ee\ee\ef\ef\ef\ef\ef\f0\f0\f0\f0\f0\f0\f1\f1\f1\f1\f1\f2\f2\f2\f2\f2\f2\f2\f3\f3\f3\f3\f3\f3\f4\f4\f4\f4\f4\f4\f4\f5\f5\f5\f5\f5\f5\f5\f6\f6\f6\f6\f6\f6\f6\f6\f7\f7\f7\f7\f7\f7\f7\f7\f8\f8\f8\f8\f8\f8\f8\f8\f8\f9\f9\f9\f9\f9\f9\f9\f9\f9\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\0f\10\10\10\10\10\10\10\10\11\11\11\11\11\11\11\11\12\12\12\12\12\12\12\12\13\13\13\13\13\13\13\13\14\14\14\14\14\14\14\15\15\15\15\15\15\15\16\16\16\16\16\16\16\16\17\17\17\17\17\17\17\18\18\18\18\18\18\19\19\19\19\19\19\19\1a\1a\1a\1a\1a\1a\1a\1b\1b\1b\1b\1b\1b\1c\1c\1c\1c\1c\1c\1c\1d\1d\1d\1d\1d\1d\1e\1e\1e\1e\1e\1e\1f\1f\1f\1f\1f\1f      !!!!!!\22\22\22\22\22\22######$$$$$$%%%%%&&&&&&'''''(((((()))))******+++++,,,,,------...../////0000011111222223333344444555556666677778888899999:::::;;;;<<<<<=====>>>>?????@@@@AAAAABBBBCCCCCDDDDEEEEEFFFFGGGGGHHHHIIIIJJJJJKKKKLLLLMMMMMNNNNOOOOPPPPQQQQQRRRRSSSSTTTTUUUUVVVVVWWWWXXXXYYYYZZZZ[[[[\5c\5c\5c\5c]]]]^^^^^____````aaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkkkllllmmmmnnnnooooppppqqqqrrrrssssttttuuuuvvvvwwwwxxxxyyyyzzzz{{{{||||}}}}~~~~\7f\7f\7f\80\80\80\80\81\81\81\81\82\82\82\82\83\83\83\83\84\84\84\84\85\85\85\85\86\86\86\86\87\87\87\87\88\88\88\88\89\89\89\89\8a\8a\8a\8a\8b\8b\8b\8b\8c\8c\8c\8c\8d\8d\8d\8d\8e\8e\8e\8e\8f\8f\8f\8f\90\90\90\90\91\91\91\91\92\92\92\92\92\93\93\93\93\94\94\94\94\95\95\95\95\96\96\96\96\97\97\97\97\98\98\98\98\99\99\99\99\9a\9a\9a\9a\9b\9b\9b\9b\9c\9c\9c\9c\9c\9d\9d\9d\9d\9e\9e\9e\9e\9f\9f\9f\9f\a0\a0\a0\a0\a1\a1\a1\a1\a2\a2\a2\a2\a2\a3\a3\a3\a3\a4\a4\a4\a4\a5\a5\a5\a5\a6\a6\a6\a6\a6\a7\a7\a7\a7\a8\a8\a8\a8\a9\a9\a9\a9\a9\aa\aa\aa\aa\ab\ab\ab\ab\ac\ac\ac\ac\ac\ad\ad\ad\ad\ae\ae\ae\ae\ae\af\af\af\af\b0\b0\b0\b0\b0\b1\b1\b1\b1\b2\b2\b2\b2\b2\b3\b3\b3\b3\b4\b4\b4\b4\b4\b5\b5\b5\b5\b6\b6\b6\b6\b6\b7\b7\b7\b7\b8\b8\b8\b8\b8\b9\b9\b9\b9\b9\ba\ba\ba\ba\ba\bb\bb\bb\bb\bc\bc\bc\bc\bc\bd\bd\bd\bd\bd\be\be\be\be\be\bf\bf\bf\bf\bf\c0\c0\c0\c0\c0\c1\c1\c1\c1\c2\c2\c2\c2\c2\c3\c3\c3\c3\c3\c3\c4\c4\c4\c4\c4\c5\c5\c5\c5\c5\c6\c6\c6\c6\c6\c7\c7\c7\c7\c7\c8\c8\c8\c8\c8\c9\c9\c9\c9\c9\c9\ca\ca\ca\ca\ca\cb\cb\cb\cb\cb\cc\cc\cc\cc\cc\cc\cd\cd\cd\cd\cd\ce\ce\ce\ce\ce\ce\cf\cf\cf\cf\cf\d0\d0\d0\d0\d0\d0\d1\d1\d1\d1\d1\d1\d2\d2\d2\d2\d2\d2\d3\d3\d3\d3\d3\d3\d4\d4\d4\d4\d4\d4\d5\d5\d5\d5\d5\d5\d6\d6\d6\d6\d6\d6\d7\d7\d7\d7\d7\d7\d8\d8\d8\d8\d8\d8\d9\d9\d9\d9\d9\d9\d9\da\da\da\da\da\da\db\db\db\db\db\db\db\dc\dc\dc\dc\dc\dc\dd\dd\dd\dd\dd\dd\dd\de\de\de\de\de\de\de\df\df\df\df\df\df\df\e0\e0\e0\e0\e0\e0\e0\e1\e1\e1\e1\e1\e1\e1\e1\e2\e2\e2\e2\e2\e2\e2\e3\e3\e3\e3\e3\e3\e3\e3\e4\e4\e4\e4\e4\e4\e4\e5\e5\e5\e5\e5\e5\e5\e5\e6\e6\e6\e6\e6\e6\e6\e6\e6\e7\e7\e7\e7\e7\e7\e7\e7\e8\e8\e8\e8\e8\e8\e8\e8\e9\e9\e9\e9\e9\e9\e9\e9\e9\ea\ea\ea\ea\ea\ea\ea\ea\ea\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\ec\ec\ec\ec\ec\ec\ec\ec\ec\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\10\10\10\10\10\10\10\10\10\10\10\10\10\10\10\10\10\11\11\11\11\11\11\11\11\11\11\11\11\11\11\11\11\12\12\12\12\12\12\12\12\12\12\12\12\12\12\12\12\13\13\13\13\13\13\13\13\13\13\13\13\13\13\13\14\14\14\14\14\14\14\14\14\14\14\14\14\14\14\15\15\15\15\15\15\15\15\15\15\15\15\15\15\15\16\16\16\16\16\16\16\16\16\16\16\16\16\16\17\17\17\17\17\17\17\17\17\17\17\17\17\17\18\18\18\18\18\18\18\18\18\18\18\18\18\18\19\19\19\19\19\19\19\19\19\19\19\19\19\1a\1a\1a\1a\1a\1a\1a\1a\1a\1a\1a\1a\1a\1a\1b\1b\1b\1b\1b\1b\1b\1b\1b\1b\1b\1b\1b\1c\1c\1c\1c\1c\1c\1c\1c\1c\1c\1c\1c\1d\1d\1d\1d\1d\1d\1d\1d\1d\1d\1d\1d\1d\1e\1e\1e\1e\1e\1e\1e\1e\1e\1e\1e\1e\1f\1f\1f\1f\1f\1f\1f\1f\1f\1f\1f\1f\1f            !!!!!!!!!!!!\22\22\22\22\22\22\22\22\22\22\22############$$$$$$$$$$$%%%%%%%%%%%%&&&&&&&&&&&'''''''''''((((((((((()))))))))))**********+++++++++++,,,,,,,,,,,----------..........///////////00000000001111111111222222222233333333334444444444555555555666666666677777777778888888889999999999:::::::::;;;;;;;;;;<<<<<<<<<=========>>>>>>>>>??????????@@@@@@@@@AAAAAAAAABBBBBBBBBCCCCCCCCCDDDDDDDDDEEEEEEEEEFFFFFFFFGGGGGGGGGHHHHHHHHHIIIIIIIIIJJJJJJJJKKKKKKKKKLLLLLLLLLMMMMMMMMNNNNNNNNNOOOOOOOOPPPPPPPPPQQQQQQQQRRRRRRRRRSSSSSSSSTTTTTTTTTUUUUUUUUVVVVVVVVWWWWWWWWWXXXXXXXXYYYYYYYYZZZZZZZZ[[[[[[[[[\5c\5c\5c\5c\5c\5c\5c\5c]]]]]]]]^^^^^^^^________````````aaaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffffgggggggghhhhhhhhiiiiiiiijjjjjjjjkkkkkkkkllllllllmmmmmmmmnnnnnnnnooooooooppppppppqqqqqqqqrrrrrrrrssssssssttttttttuuuuuuuuvvvvvvvvwwwwwwwxxxxxxxxyyyyyyyyzzzzzzzz{{{{{{{{||||||||}}}}}}}}~~~~~~~~\7f\7f\7f\7f\7f\7f\7f\7f\80\80\80\80\80\80\80\80\81\81\81\81\81\81\81\81\82\82\82\82\82\82\82\82\83\83\83\83\83\83\83\83\84\84\84\84\84\84\84\84\85\85\85\85\85\85\85\85\86\86\86\86\86\86\86\86\87\87\87\87\87\87\87\87\88\88\88\88\88\88\88\88\89\89\89\89\89\89\89\89\8a\8a\8a\8a\8a\8a\8a\8a\8b\8b\8b\8b\8b\8b\8b\8b\8c\8c\8c\8c\8c\8c\8c\8c\8d\8d\8d\8d\8d\8d\8d\8d\8e\8e\8e\8e\8e\8e\8e\8e\8f\8f\8f\8f\8f\8f\8f\8f\90\90\90\90\90\90\90\90\91\91\91\91\91\91\91\91\92\92\92\92\92\92\92\92\93\93\93\93\93\93\93\93\94\94\94\94\94\94\94\94\95\95\95\95\95\95\95\95\95\96\96\96\96\96\96\96\96\97\97\97\97\97\97\97\97\98\98\98\98\98\98\98\98\99\99\99\99\99\99\99\99\9a\9a\9a\9a\9a\9a\9a\9a\9a\9b\9b\9b\9b\9b\9b\9b\9b\9c\9c\9c\9c\9c\9c\9c\9c\9d\9d\9d\9d\9d\9d\9d\9d\9e\9e\9e\9e\9e\9e\9e\9e\9e\9f\9f\9f\9f\9f\9f\9f\9f\a0\a0\a0\a0\a0\a0\a0\a0\a0\a1\a1\a1\a1\a1\a1\a1\a1\a2\a2\a2\a2\a2\a2\a2\a2\a3\a3\a3\a3\a3\a3\a3\a3\a3\a4\a4\a4\a4\a4\a4\a4\a4\a5\a5\a5\a5\a5\a5\a5\a5\a5\a6\a6\a6\a6\a6\a6\a6\a6\a7\a7\a7\a7\a7\a7\a7\a7\a7\a8\a8\a8\a8\a8\a8\a8\a8\a8\a9\a9\a9\a9\a9\a9\a9\a9\aa\aa\aa\aa\aa\aa\aa\aa\aa\ab\ab\ab\ab\ab\ab\ab\ab\ab\ac\ac\ac\ac\ac\ac\ac\ac\ac\ad\ad\ad\ad\ad\ad\ad\ad\ae\ae\ae\ae\ae\ae\ae\ae\ae\af\af\af\af\af\af\af\af\af\b0\b0\b0\b0\b0\b0\b0\b0\b0\b1\b1\b1\b1\b1\b1\b1\b1\b1\b2\b2\b2\b2\b2\b2\b2\b2\b2\b3\b3\b3\b3\b3\b3\b3\b3\b3\b4\b4\b4\b4\b4\b4\b4\b4\b4\b5\b5\b5\b5\b5\b5\b5\b5\b5\b6\b6\b6\b6\b6\b6\b6\b6\b6\b6\b7\b7\b7\b7\b7\b7\b7\b7\b7\b8\b8\b8\b8\b8\b8\b8\b8\b8\b9\b9\b9\b9\b9\b9\b9\b9\b9\b9\ba\ba\ba\ba\ba\ba\ba\ba\ba\bb\bb\bb\bb\bb\bb\bb\bb\bb\bb\bc\bc\bc\bc\bc\bc\bc\bc\bc\bd\bd\bd\bd\bd\bd\bd\bd\bd\bd\be\be\be\be\be\be\be\be\be\bf\bf\bf\bf\bf\bf\bf\bf\bf\bf\c0\c0\c0\c0\c0\c0\c0\c0\c0\c0\c1\c1\c1\c1\c1\c1\c1\c1\c1\c1\c2\c2\c2\c2\c2\c2\c2\c2\c2\c2\c3\c3\c3\c3\c3\c3\c3\c3\c3\c3\c4\c4\c4\c4\c4\c4\c4\c4\c4\c4\c5\c5\c5\c5\c5\c5\c5\c5\c5\c5\c6\c6\c6\c6\c6\c6\c6\c6\c6\c6\c6\c7\c7\c7\c7\c7\c7\c7\c7\c7\c7\c8\c8\c8\c8\c8\c8\c8\c8\c8\c8\c8\c9\c9\c9\c9\c9\c9\c9\c9\c9\c9\ca\ca\ca\ca\ca\ca\ca\ca\ca\ca\ca\cb\cb\cb\cb\cb\cb\cb\cb\cb\cb\cb\cc\cc\cc\cc\cc\cc\cc\cc\cc\cc\cc\cd\cd\cd\cd\cd\cd\cd\cd\cd\cd\cd\ce\ce\ce\ce\ce\ce\ce\ce\ce\ce\ce\cf\cf\cf\cf\cf\cf\cf\cf\cf\cf\cf\d0\d0\d0\d0\d0\d0\d0\d0\d0\d0\d0\d1\d1\d1\d1\d1\d1\d1\d1\d1\d1\d1\d1\d2\d2\d2\d2\d2\d2\d2\d2\d2\d2\d2\d3\d3\d3\d3\d3\d3\d3\d3\d3\d3\d3\d3\d4\d4\d4\d4\d4\d4\d4\d4\d4\d4\d4\d4\d5\d5\d5\d5\d5\d5\d5\d5\d5\d5\d5\d5\d6\d6\d6\d6\d6\d6\d6\d6\d6\d6\d6\d6\d7\d7\d7\d7\d7\d7\d7\d7\d7\d7\d7\d7\d7\d8\d8\d8\d8\d8\d8\d8\d8\d8\d8\d8\d8\d9\d9\d9\d9\d9\d9\d9\d9\d9\d9\d9\d9\d9\da\da\da\da\da\da\da\da\da\da\da\da\da\db\db\db\db\db\db\db\db\db\db\db\db\db\dc\dc\dc\dc\dc\dc\dc\dc\dc\dc\dc\dc\dc\dc\dd\dd\dd\dd\dd\dd\dd\dd\dd\dd\dd\dd\dd\de\de\de\de\de\de\de\de\de\de\de\de\de\de\df\df\df\df\df\df\df\df\df\df\df\df\df\df\e0\e0\e0\e0\e0\e0\e0\e0\e0\e0\e0\e0\e0\e0\e0\e1\e1\e1\e1\e1\e1\e1\e1\e1\e1\e1\e1\e1\e1\e2\e2\e2\e2\e2\e2\e2\e2\e2\e2\e2\e2\e2\e2\e2\e3\e3\e3\e3\e3\e3\e3\e3\e3\e3\e3\e3\e3\e3\e3\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e4\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e5\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e6\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e7\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e8\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\e9\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\ea\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\eb\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ec\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ed\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ee\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\ef\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f0\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f1\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f2\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f3\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f4\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f5\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f6\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f7\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f8\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\f9\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fa\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fb\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fc\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fd\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\fe\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\00\00\00\00\00\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\02\00\00\00\02\00\00\00\02\00\00\00\02\00\00\00\02\00\00\00\02\00\00\00\02\00\00\00\02\00\00\00\03\00\00\00\03\00\00\00\03\00\00\00\03\00\00\00\03\00\00\00\04\00\00\00\04\00\00\00\04\00\00\00\04\00\00\00\05\00\00\00\05\00\00\00\05\00\00\00\06\00\00\00\06\00\00\00\06\00\00\00\07\00\00\00\07\00\00\00\08\00\00\00\08\00\00\00\09\00\00\00\09\00\00\00\0a\00\00\00\0a\00\00\00\0b\00\00\00\0c\00\00\00\0d\00\00\00\0d\00\00\00\0e\00\00\00\0f\00\00\00\10\00\00\00\11\00\00\00\12\00\00\00\14\00\00\00\15\00\00\00\16\00\00\00\18\00\00\00\19\00\00\00\1b\00\00\00\1c\00\00\00\1e\00\00\00 \00\00\00\22\00\00\00%\00\00\00'\00\00\00*\00\00\00,\00\00\00/\00\00\002\00\00\005\00\00\009\00\00\00=\00\00\00A\00\00\00E\00\00\00I\00\00\00N\00\00\00S\00\00\00X\00\00\00^\00\00\00d\00\00\00k\00\00\00r\00\00\00y\00\00\00\81\00\00\00\89\00\00\00\92\00\00\00\9c\00\00\00\a6\00\00\00\b1\00\00\00\bc\00\00\00\c9\00\00\00\d6\00\00\00\e4\00\00\00\f2\00\00\00\02\01\00\00\13\01\00\00%\01\00\008\01\00\00L\01\00\00b\01\00\00y\01\00\00\91\01\00\00\ab\01\00\00\c7\01\00\00\e4\01\00\00\04\02\00\00%\02\00\00I\02\00\00o\02\00\00\98\02\00\00\c3\02\00\00\f1\02\00\00\22\03\00\00V\03\00\00\8d\03\00\00\c8\03\00\00\07\04\00\00J\04\00\00\91\04\00\00\dd\04\00\00.\05\00\00\85\05\00\00\e0\05\00\00B\06\00\00\aa\06\00\00\19\07\00\00\8f\07\00\00\0d\08\00\00\93\08\00\00\22\09\00\00\b9\09\00\00[\0a\00\00\07\0b\00\00\bf\0b\00\00\82\0c\00\00R\0d\00\000\0e\00\00\1c\0f\00\00\18\10\00\00#\11\00\00@\12\00\00p\13\00\00\b3\14\00\00\0c\16\00\00z\17\00\00\01\19\00\00\a1\1a\00\00\5c\1c\00\004\1e\00\00* \00\00A\22\00\00{$\00\00\da&\00\00a)\00\00\11,\00\00\ee.\00\00\fb1\00\00:5\00\00\b08\00\00_<\00\00K@\00\00yD\00\00\ecH\00\00\a9M\00\00\b5R\00\00\15X\00\00\ce]\00\00\e7c\00\00ej\00\00Oq\00\00\acx\00\00\84\80\00\00\de\88\00\00\c3\91\00\00<\9b\00\00R\a5\00\00\10\b0\00\00\81\bb\00\00\b1\c7\00\00\ab\d4\00\00}\e2\00\005\f1\00\00\e2\00\01\00\93\11\01\00Z#\01\00J6\01\00tJ\01\00\ed_\01\00\ccv\01\00'\8f\01\00\17\a9\01\00\b7\c4\01\00#\e2\01\00x\01\02\00\d6\22\02\00_F\02\008l\02\00\86\94\02\00s\bf\02\00*\ed\02\00\d9\1d\03\00\b2Q\03\00\ea\88\03\00\b9\c3\03\00Y\02\04\00\0cE\04\00\14\8c\04\00\ba\d7\04\00K(\05\00\18~\05\00x\d9\05\00\c8:\06\00k\a2\06\00\cb\10\07\00W\86\07\00\86\03\08\00\d7\88\08\00\d3\16\09\00\09\ae\09\00\12O\0a\00\93\fa\0a\008\b1\0b\00\bds\0c\00\e5B\0d\00\83\1f\0e\00x\0a\0f\00\b2\04\10\00.\0f\11\00\fc*\12\00<Y\13\00\1f\9b\14\00\ee\f1\15\00\03_\17\00\d3\e3\18\00\e6\81\1a\00\e3:\1c\00\88\10\1e\00\b2\04 \00\5c\19\22\00\a5P$\00\cb\ac&\0040)\00l\dd+\00-\b7.\00Y\c01\00\07\fc4\00\7fm8\00?\18<\00\00\00@\00\00\01\00\00\80\00\00\00V\00\00\00@\00\00\00\00\0a\0b\0b\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\0f\00\04\05\05\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\09\00\01\02\02\03\03\03\03\00\00\00\00\00\00\00\00\00@\00\00\fb?\00\00\ec?\00\00\d4?\00\00\b1?\00\00\85?\00\00O?\00\00\0f?\00\00\c5>\00\00r>\00\00\15>\00\00\af=\00\00?=\00\00\c5<\00\00B<\00\00\b6;\00\00!;\00\00\82:\00\00\db9\00\00+9\00\00q8\00\00\b07\00\00\e56\00\00\126\00\0075\00\00S4\00\00h3\00\00t2\00\00y1\00\00v0\00\00l/\00\00Z.\00\00A-\00\00!,\00\00\fb*\00\00\ce)\00\00\9a(\00\00`'\00\00 &\00\00\da$\00\00\8e#\00\00=\22\00\00\e7 \00\00\8c\1f\00\00+\1e\00\00\c6\1c\00\00]\1b\00\00\ef\19\00\00~\18\00\00\09\17\00\00\90\15\00\00\13\14\00\00\94\12\00\00\12\11\00\00\8d\0f\00\00\06\0e\00\00|\0c\00\00\f1\0a\00\00d\09\00\00\d6\07\00\00F\06\00\00\b5\04\00\00$\03\00\00\92\01\00\00\00\00\00\00o\fe\ff\ff\dd\fc\ff\ffL\fb\ff\ff\bb\f9\ff\ff+\f8\ff\ff\9d\f6\ff\ff\10\f5\ff\ff\85\f3\ff\ff\fb\f1\ff\fft\f0\ff\ff\ef\ee\ff\ffm\ed\ff\ff\ee\eb\ff\ffq\ea\ff\ff\f8\e8\ff\ff\83\e7\ff\ff\12\e6\ff\ff\a4\e4\ff\ff;\e3\ff\ff\d6\e1\ff\ffu\e0\ff\ff\1a\df\ff\ff\c4\dd\ff\ffs\dc\ff\ff'\db\ff\ff\e1\d9\ff\ff\a1\d8\ff\ffg\d7\ff\ff3\d6\ff\ff\06\d5\ff\ff\e0\d3\ff\ff\c0\d2\ff\ff\a7\d1\ff\ff\95\d0\ff\ff\8b\cf\ff\ff\88\ce\ff\ff\8d\cd\ff\ff\99\cc\ff\ff\ae\cb\ff\ff\ca\ca\ff\ff\ef\c9\ff\ff\1c\c9\ff\ffQ\c8\ff\ff\90\c7\ff\ff\d6\c6\ff\ff&\c6\ff\ff\7f\c5\ff\ff\e0\c4\ff\ffK\c4\ff\ff\bf\c3\ff\ff<\c3\ff\ff\c2\c2\ff\ffR\c2\ff\ff\ec\c1\ff\ff\8f\c1\ff\ff<\c1\ff\ff\f2\c0\ff\ff\b2\c0\ff\ff|\c0\ff\ffP\c0\ff\ff-\c0\ff\ff\15\c0\ff\ff\06\c0\ff\ff\01\c0\ff\ff\00\00\00\00\00\00\00\00\00\00\00\00\ff\ff?\00\9ba(\00\96z\19\00z\13\10\00\b0$\0a\00ff\06\00\c3\09\04\00B\8c\02\00\8c\9b\01\00\ab\03\01\00\d7\a3\00\00`g\00\00:A\00\00()\00\00\f8\19\00\00b\10\00\00V\0a\00\00\86\06\00\00\1e\04\00\00\99\02\00\00\a3\01\00\00\09\01\00\00\a7\00\00\00i\00\00\00B\00\00\00*\00\00\00\1a\00\00\00\11\00\00\00\0b\00\00\00\07\00\00\00\04\00\00\00\03\00\00\00\02\00\00\00\01\00\00\00\01\00\00\00\00\00\00\00\fc\01\00\00\f5\01\00\00\ee\01\00\00\e7\01\00\00\e0\01\00\00\d9\01\00\00\d2\01\00\00\cc\01\00\00\c5\01\00\00\bf\01\00\00\b8\01\00\00\b2\01\00\00\ac\01\00\00\a6\01\00\00\a0\01\00\00\9a\01\00\00\94\01\00\00\8e\01\00\00\88\01\00\00\83\01\00\00}\01\00\00x\01\00\00r\01\00\00m\01\00\00h\01\00\00c\01\00\00^\01\00\00Y\01\00\00T\01\00\00O\01\00\00J\01\00\00E\01\00\00\0aj\01\00>g\01\00\83d\01\00\d7a\01\00;_\01\00\ad\5c\01\00-Z\01\00\bbW\01\00UU\01\00\fdR\01\00\b0P\01\00pN\01\00;L\01\00\11J\01\00\f1G\01\00\dcE\01\00\d1C\01\00\d0A\01\00\d8?\01\00\e9=\01\00\03<\01\00&:\01\00Q8\01\00\846\01\00\bf4\01\00\023\01\00L1\01\00\9e/\01\00\f6-\01\00U,\01\00\bb*\01\00()\01\00\9a'\01\00\13&\01\00\92$\01\00\17#\01\00\a2!\01\002 \01\00\c7\1e\01\00b\1d\01\00\02\1c\01\00\a7\1a\01\00P\19\01\00\ff\17\01\00\b3\16\01\00k\15\01\00'\14\01\00\e8\12\01\00\ad\11\01\00v\10\01\00D\0f\01\00\15\0e\01\00\ea\0c\01\00\c4\0b\01\00\a0\0a\01\00\81\09\01\00e\08\01\00M\07\01\008\06\01\00'\05\01\00\19\04\01\00\0e\03\01\00\06\02\01\00\02\01\01\00\00\00\01\00\00\00\00\00\00\00\00\00\00\00\00\00\cc\02\00\00\bb\02\00\00\ac\02\00\00\9c\02\00\00\8e\02\00\00\80\02\00\00r\02\00\00f\02\00\00X\02\00\00M\02\00\00@\02\00\005\02\00\00*\02\00\00 \02\00\00\15\02\00\00\0b\02\00\00\01\02\00\00\f8\01\00\00\ef\01\00\00\e6\01\00\00\dd\01\00\00\d5\01\00\00\cd\01\00\00\c5\01\00\00\bd\01\00\00\b6\01\00\00\ae\01\00\00\a8\01\00\00\a1\01\00\00\9a\01\00\00\93\01\00\00\8e\01\00\00\87\01\00\00\81\01\00\00{\01\00\00u\01\00\00p\01\00\00k\01\00\00e\01\00\00`\01\00\00[\01\00\00W\01\00\00Q\01\00\00L\01\00\00H\01\00\00D\01\00\00?\01\00\00;\01\00\007\01\00\002\01\00\00/\01\00\00+\01\00\00&\01\00\00$\01\00\00\1f\01\00\00\1c\01\00\00\18\01\00\00\15\01\00\00\11\01\00\00\0e\01\00\00\0b\01\00\00\08\01\00\00\04\01\00\00\02\01\00\00\00 \00\00\a0\16\00\00\90V\00\01\a8V\00\01\c0V\00\01\d4V\00\01\e8V\00\01\00\00\00\00\00\00\00\00\b7\1d\c1\04n;\82\09\d9&C\0d\dcv\04\13kk\c5\17\b2M\86\1a\05PG\1e\b8\ed\08&\0f\f0\c9\22\d6\d6\8a/a\cbK+d\9b\0c5\d3\86\cd1\0a\a0\8e<\bd\bdO8p\db\11L\c7\c6\d0H\1e\e0\93E\a9\fdRA\ac\ad\15_\1b\b0\d4[\c2\96\97Vu\8bVR\c86\19j\7f+\d8n\a6\0d\9bc\11\10Zg\14@\1dy\a3]\dc}z{\9fp\cdf^t\e0\b6#\98W\ab\e2\9c\8e\8d\a1\919\90`\95<\c0'\8b\8b\dd\e6\8fR\fb\a5\82\e5\e6d\86X[+\be\efF\ea\ba6`\a9\b7\81}h\b3\84-/\ad30\ee\a9\ea\16\ad\a4]\0bl\a0\90m2\d4'p\f3\d0\feV\b0\ddIKq\d9L\1b6\c7\fb\06\f7\c3\22 \b4\ce\95=u\ca(\80:\f2\9f\9d\fb\f6F\bb\b8\fb\f1\a6y\ff\f4\f6>\e1C\eb\ff\e5\9a\cd\bc\e8-\d0}\ecwp\864\c0mG0\19K\04=\aeV\c59\ab\06\82'\1c\1bC#\c5=\00.r \c1*\cf\9d\8e\12x\80O\16\a1\a6\0c\1b\16\bb\cd\1f\13\eb\8a\01\a4\f6K\05}\d0\08\08\ca\cd\c9\0c\07\ab\97x\b0\b6V|i\90\15q\de\8d\d4u\db\dd\93kl\c0Ro\b5\e6\11b\02\fb\d0f\bfF\9f^\08[^Z\d1}\1dWf`\dcSc0\9bM\d4-ZI\0d\0b\19D\ba\16\d8@\97\c6\a5\ac \dbd\a8\f9\fd'\a5N\e0\e6\a1K\b0\a1\bf\fc\ad`\bb%\8b#\b6\92\96\e2\b2/+\ad\8a\986l\8eA\10/\83\f6\0d\ee\87\f3]\a9\99D@h\9d\9df+\90*{\ea\94\e7\1d\b4\e0P\00u\e4\89&6\e9>;\f7\ed;k\b0\f3\8cvq\f7UP2\fa\e2M\f3\fe_\f0\bc\c6\e8\ed}\c21\cb>\cf\86\d6\ff\cb\83\86\b8\d54\9by\d1\ed\bd:\dcZ\a0\fb\d8\ee\e0\0ciY\fd\cdm\80\db\8e`7\c6Od2\96\08z\85\8b\c9~\5c\ad\8as\eb\b0KwV\0d\04O\e1\10\c5K86\86F\8f+GB\8a{\00\5c=f\c1X\e4@\82US]CQ\9e;\1d%)&\dc!\f0\00\9f,G\1d^(BM\196\f5P\d82,v\9b?\9bkZ;&\d6\15\03\91\cb\d4\07H\ed\97\0a\ff\f0V\0e\fa\a0\11\10M\bd\d0\14\94\9b\93\19#\86R\1d\0eV/\f1\b9K\ee\f5`m\ad\f8\d7pl\fc\d2 +\e2e=\ea\e6\bc\1b\a9\eb\0b\06h\ef\b6\bb'\d7\01\a6\e6\d3\d8\80\a5\deo\9dd\daj\cd#\c4\dd\d0\e2\c0\04\f6\a1\cd\b3\eb`\c9~\8d>\bd\c9\90\ff\b9\10\b6\bc\b4\a7\ab}\b0\a2\fb:\ae\15\e6\fb\aa\cc\c0\b8\a7{\ddy\a3\c6`6\9bq}\f7\9f\a8[\b4\92\1fFu\96\1a\162\88\ad\0b\f3\8ct-\b0\81\c30q\85\99\90\8a].\8dKY\f7\ab\08T@\b6\c9PE\e6\8eN\f2\fbOJ+\dd\0cG\9c\c0\cdC!}\82{\96`C\7fOF\00r\f8[\c1v\fd\0b\86hJ\16Gl\930\04a$-\c5e\e9K\9b\11^VZ\15\87p\19\180m\d8\1c5=\9f\02\82 ^\06[\06\1d\0b\ec\1b\dc\0fQ\a6\937\e6\bbR3?\9d\11>\88\80\d0:\8d\d0\97$:\cdV \e3\eb\15-T\f6\d4)y&\a9\c5\ce;h\c1\17\1d+\cc\a0\00\ea\c8\a5P\ad\d6\12Ml\d2\cbk/\df|v\ee\db\c1\cb\a1\e3v\d6`\e7\af\f0#\ea\18\ed\e2\ee\1d\bd\a5\f0\aa\a0d\f4s\86'\f9\c4\9b\e6\fd\09\fd\b8\89\be\e0y\8dg\c6:\80\d0\db\fb\84\d5\8b\bc\9ab\96}\9e\bb\b0>\93\0c\ad\ff\97\b1\10\b0\af\06\0dq\ab\df+2\a6h6\f3\a2mf\b4\bc\da{u\b8\03]6\b5\b4@\f7\b1\00\00\00\00\dc\c1\19\d2\0f\9e\f2\a0\d3_\ebr\a9!$Eu\e0=\97\a6\bf\d6\e5z~\cf7RCH\8a\8e\82QX]\dd\ba*\81\1c\a3\f8\fbbl\cf'\a3u\1d\f4\fc\9eo(=\87\bd\13\9bQ\10\cfZH\c2\1c\05\a3\b0\c0\c4\bab\ba\bauUf{l\87\b5$\87\f5i\e5\9e'A\d8\19\9a\9d\19\00HNF\eb:\92\87\f2\e8\e8\f9=\df48$\0d\e7g\cf\7f;\a6\d6\ad&6\a3 \fa\f7\ba\f2)\a8Q\80\f5iHR\8f\17\87eS\d6\9e\b7\80\89u\c5\5cHl\17tu\eb\aa\a8\b4\f2x{\eb\19\0a\a7*\00\d8\ddT\cf\ef\01\95\d6=\d2\ca=O\0e\0b$\9d5\ad\f20\e9l\eb\e2:3\00\90\e6\f2\19B\9c\8c\d6u@M\cf\a7\93\12$\d5O\d3=\07g\ee\ba\ba\bb/\a3hhpH\1a\b4\b1Q\c8\ce\cf\9e\ff\12\0e\87-\c1Ql_\1d\90u\8dLlFA\90\ad_\93C\f2\b4\e1\9f3\ad3\e5Mb\049\8c{\d6\ea\d3\90\a46\12\89v\1e/\0e\cb\c2\ee\17\19\11\b1\fck\cdp\e5\b9\b7\0e*\8ek\cf3\5c\b8\90\d8.dQ\c1\fc_\f7\17Q\836\0e\83Pi\e5\f1\8c\a8\fc#\f6\d63\14*\17*\c6\f9H\c1\b4%\89\d8f\0d\b4_\db\d1uF\09\02*\ad{\de\eb\b4\a9\a4\95{\9exTbL\ab\0b\89>w\ca\90\ecjZ\e5a\b6\9b\fc\b3e\c4\17\c1\b9\05\0e\13\c3{\c1$\1f\ba\d8\f6\cc\e53\84\10$*V8\19\ad\eb\e4\d8\b497\87_K\ebFF\99\918\89\aeM\f9\90|\9e\a6{\0eBgb\dcy\c1\b4q\a5\00\ad\a3v_F\d1\aa\9e_\03\d0\e0\904\0c!\89\e6\df~b\94\03\bf{F+\82\fc\fb\f7C\e5)$\1c\0e[\f8\dd\17\89\82\a3\d8\be^b\c1l\8d=*\1eQ\fc3\cc\98\d8\8c\82D\19\95P\97F~\22K\87g\f01\f9\a8\c7\ed8\b1\15>gZg\e2\a6C\b5\ca\9b\c4\08\16Z\dd\da\c5\056\a8\19\c4/zc\ba\e0M\bf{\f9\9fl$\12\ed\b0\e5\0b?\8bC\dd\92W\82\c4@\84\dd/2X\1c6\e0\22b\f9\d7\fe\a3\e0\05-\fc\0bw\f1=\12\a5\d9\00\95\18\05\c1\8c\ca\d6\9eg\b8\0a_~jp!\b1]\ac\e0\a8\8f\7f\bfC\fd\a3~Z/\be\ee/\a2b/6p\b1p\dd\02m\b1\c4\d0\17\cf\0b\e7\cb\0e\125\18Q\f9G\c4\90\e0\95\ec\adg(0l~\fa\e33\95\88?\f2\8cZE\8cCm\99MZ\bfJ\12\b1\cd\96\d3\a8\1f\adu~\b2q\b4g`\a2\eb\8c\12~*\95\c0\04TZ\f7\d8\95C%\0b\ca\a8W\d7\0b\b1\85\ff668#\f7/\ea\f0\a8\c4\98,i\ddJV\17\12}\8a\d6\0b\afY\89\e0\dd\85H\f9\0f\d4\b4\ca\c3\08u\d3\11\db*8c\07\eb!\b1}\95\ee\86\a1T\f7Tr\0b\1c&\ae\ca\05\f4\86\f7\82IZ6\9b\9b\89ip\e9U\a8i;/\d6\a6\0c\f3\17\bf\de HT\ac\fc\89M~\c7/\9b\d3\1b\ee\82\01\c8\b1is\14pp\a1n\0e\bf\96\b2\cf\a6Da\90M6\bdQT\e4\95l\d3YI\ad\ca\8b\9a\f2!\f9F38+<M\f7\1c\e0\8c\ee\ce3\d3\05\bc\ef\12\1cn\f2\82i\e3.Cp1\fd\1c\9bC!\dd\82\91[\a3M\a6\87bTtT=\bf\06\88\fc\a6\d4\a0\c1!i|\008\bb\af_\d3\c9s\9e\ca\1b\09\e0\05,\d5!\1c\fe\06~\f7\8c\da\bf\ee^\e1\198\f3=\d8!!\ee\87\caS2F\d3\81H8\1c\b6\94\f9\05dG\a6\ee\16\9bg\f7\c4\b3Zpyo\9bi\ab\bc\c4\82\d9`\05\9b\0b\1a{T<\c6\baM\ee\15\e5\a6\9c\c9$\bfN\00\00\00\00\87\ac\d8\01\0eY\b1\03\89\f5i\02\1c\b2b\07\9b\1e\ba\06\12\eb\d3\04\95G\0b\058d\c5\0e\bf\c8\1d\0f6=t\0d\b1\91\ac\0c$\d6\a7\09\a3z\7f\08*\8f\16\0a\ad#\ce\0bp\c8\8a\1d\f7dR\1c~\91;\1e\f9=\e3\1flz\e8\1a\eb\d60\1bb#Y\19\e5\8f\81\18H\acO\13\cf\00\97\12F\f5\fe\10\c1Y&\11T\1e-\14\d3\b2\f5\15ZG\9c\17\dd\ebD\16\e0\90\15;g<\cd:\ee\c9\a48ie|9\fc\22w<{\8e\af=\f2{\c6?u\d7\1e>\d8\f4\d05_X\084\d6\ada6Q\01\b97\c4F\b22C\eaj3\ca\1f\031M\b3\db0\90X\9f&\17\f4G'\9e\01.%\19\ad\f6$\8c\ea\fd!\0bF% \82\b3L\22\05\1f\94#\a8<Z(/\90\82)\a6e\eb+!\c93*\b4\8e8/3\22\e0.\ba\d7\89,={Q-\c0!+vG\8d\f3w\cex\9auI\d4Bt\dc\93Iq[?\91p\d2\ca\f8rUf s\f8E\eex\7f\e96y\f6\1c_{q\b0\87z\e4\f7\8c\7fc[T~\ea\ae=|m\02\e5}\b0\e9\a1k7Eyj\be\b0\10h9\1c\c8i\ac[\c3l+\f7\1bm\a2\02ro%\ae\aan\88\8dde\0f!\bcd\86\d4\d5f\01x\0dg\94?\06b\13\93\dec\9af\b7a\1d\cao` \b1>M\a7\1d\e6L.\e8\8fN\a9DWO<\03\5cJ\bb\af\84K2Z\edI\b5\f65H\18\d5\fbC\9fy#B\16\8cJ@\91 \92A\04g\99D\83\cbAE\0a>(G\8d\92\f0FPy\b4P\d7\d5lQ^ \05S\d9\8c\ddRL\cb\d6W\cbg\0eVB\92gT\c5>\bfUh\1dq^\ef\b1\a9_fD\c0]\e1\e8\18\5ct\af\13Y\f3\03\cbXz\f6\a2Z\fdZz[\80CV\ec\07\ef\8e\ed\8e\1a\e7\ef\09\b6?\ee\9c\f14\eb\1b]\ec\ea\92\a8\85\e8\15\04]\e9\b8'\93\e2?\8bK\e3\b6~\22\e11\d2\fa\e0\a4\95\f1\e5#9)\e4\aa\cc@\e6-`\98\e7\f0\8b\dc\f1w'\04\f0\fe\d2m\f2y~\b5\f3\ec9\be\f6k\95f\f7\e2`\0f\f5e\cc\d7\f4\c8\ef\19\ffOC\c1\fe\c6\b6\a8\fcA\1ap\fd\d4]{\f8S\f1\a3\f9\da\04\ca\fb]\a8\12\fa`\d3C\d7\e7\7f\9b\d6n\8a\f2\d4\e9&*\d5|a!\d0\fb\cd\f9\d1r8\90\d3\f5\94H\d2X\b7\86\d9\df\1b^\d8V\ee7\da\d1B\ef\dbD\05\e4\de\c3\a9<\dfJ\5cU\dd\cd\f0\8d\dc\10\1b\c9\ca\97\b7\11\cb\1eBx\c9\99\ee\a0\c8\0c\a9\ab\cd\8b\05s\cc\02\f0\1a\ce\85\5c\c2\cf(\7f\0c\c4\af\d3\d4\c5&&\bd\c7\a1\8ae\c64\cdn\c3\b3a\b6\c2:\94\df\c0\bd8\07\c1@b}\9a\c7\ce\a5\9bN;\cc\99\c9\97\14\98\5c\d0\1f\9d\db|\c7\9cR\89\ae\9e\d5%v\9fx\06\b8\94\ff\aa`\95v_\09\97\f1\f3\d1\96d\b4\da\93\e3\18\02\92j\edk\90\edA\b3\910\aa\f7\87\b7\06/\86>\f3F\84\b9_\9e\85,\18\95\80\ab\b4M\81\22A$\83\a5\ed\fc\82\08\ce2\89\8fb\ea\88\06\97\83\8a\81;[\8b\14|P\8e\93\d0\88\8f\1a%\e1\8d\9d\899\8c\a0\f2h\a1'^\b0\a0\ae\ab\d9\a2)\07\01\a3\bc@\0a\a6;\ec\d2\a7\b2\19\bb\a55\b5c\a4\98\96\ad\af\1f:u\ae\96\cf\1c\ac\11c\c4\ad\84$\cf\a8\03\88\17\a9\8a}~\ab\0d\d1\a6\aa\d0:\e2\bcW\96:\bd\decS\bfY\cf\8b\be\cc\88\80\bbK$X\ba\c2\d11\b8E}\e9\b9\e8^'\b2o\f2\ff\b3\e6\07\96\b1a\abN\b0\f4\ecE\b5s@\9d\b4\fa\b5\f4\b6}\19,\b7\00\00\00\00\b7\9am\dc\d9(\1a\bcn\b2w`\05L\f5|\b2\d6\98\a0\dcd\ef\c0k\fe\82\1c\0a\98\ea\f9\bd\02\87%\d3\b0\f0Ed*\9d\99\0f\d4\1f\85\b8NrY\d6\fc\059afh\e5\a3-\14\f7\14\b7y+z\05\0eK\cd\9fc\97\a6a\e1\8b\11\fb\8cW\7fI\fb7\c8\d3\96\eb\a9\b5\fe\0e\1e/\93\d2p\9d\e4\b2\c7\07\89n\ac\f9\0br\1bcf\aeu\d1\11\ce\c2K|\12\f1F\e9\eaF\dc\846(n\f3V\9f\f4\9e\8a\f4\0a\1c\96C\90qJ-\22\06*\9a\b8k\f6\fb\de\03\13LDn\cf\22\f6\19\af\95lts\fe\92\f6oI\08\9b\b3'\ba\ec\d3\90 \81\0fRk\fd\1d\e5\f1\90\c1\8bC\e7\a1<\d9\8a}W'\08a\e0\bde\bd\8e\0f\12\dd9\95\7f\01X\f3\17\e4\efiz8\81\db\0dX6A`\84]\bf\e2\98\ea%\8fD\84\97\f8$3\0d\95\f8U\90\13\d1\e2\0a~\0d\8c\b8\09m;\22d\b1P\dc\e6\ad\e7F\8bq\89\f4\fc\11>n\91\cd_\08\f9(\e8\92\94\f4\86 \e3\941\ba\8eHZD\0cT\ed\dea\88\83l\16\e84\f6{4\f6\bd\07&A'j\fa/\95\1d\9a\98\0fpF\f3\f1\f2ZDk\9f\86*\d9\e8\e6\9dC\85:\fc%\ed\dfK\bf\80\03%\0d\f7c\92\97\9a\bf\f9i\18\a3N\f3u\7f A\02\1f\97\dbo\c3\a4\d6\fa;\13L\97\e7}\fe\e0\87\cad\8d[\a1\9a\0fG\16\00b\9bx\b2\15\fb\cf(x'\aeN\10\c2\19\d4}\1ewf\0a~\c0\fcg\a2\ab\02\e5\be\1c\98\88br*\ff\02\c5\b0\92\de\07\fb\ee\cc\b0a\83\10\de\d3\f4piI\99\ac\02\b7\1b\b0\b5-vl\db\9f\01\0cl\05l\d0\0dc\045\ba\f9i\e9\d4K\1e\89c\d1sU\08/\f1I\bf\b5\9c\95\d1\07\eb\f5f\9d\86)\1d=\e6\a6\aa\a7\8bz\c4\15\fc\1as\8f\91\c6\18q\13\da\af\eb~\06\c1Y\09fv\c3d\ba\17\a5\0c_\a0?a\83\ce\8d\16\e3y\17{?\12\e9\f9#\a5s\94\ff\cb\c1\e3\9f|[\8eC\be\10\f2Q\09\8a\9f\8dg8\e8\ed\d0\a2\851\bb\5c\07-\0c\c6j\f1bt\1d\91\d5\eepM\b4\88\18\a8\03\12utm\a0\02\14\da:o\c8\b1\c4\ed\d4\06^\80\08h\ec\f7h\dfv\9a\b4\ec{\0fL[\e1b\905S\15\f0\82\c9x,\e97\fa0^\ad\97\ec0\1f\e0\8c\87\85\8dP\e6\e3\e5\b5Qy\88i?\cb\ff\09\88Q\92\d5\e3\af\10\c9T5}\15:\87\0au\8d\1dg\a9OV\1b\bb\f8\ccvg\96~\01\07!\e4l\dbJ\1a\ee\c7\fd\80\83\1b\932\f4{$\a8\99\a7E\ce\f1B\f2T\9c\9e\9c\e6\eb\fe+|\86\22@\82\04>\f7\18i\e2\99\aa\1e\82.0s^H\ad\f5w\ff7\98\ab\91\85\ef\cb&\1f\82\17M\e1\00\0b\fa{m\d7\94\c9\1a\b7#SwkB5\1f\8e\f5\afrR\9b\1d\052,\87h\eeGy\ea\f2\f0\e3\87.\9eQ\f0N)\cb\9d\92\eb\80\e1\80\5c\1a\8c\5c2\a8\fb<\852\96\e0\ee\cc\14\fcYVy 7\e4\0e@\80~c\9c\e1\18\0byV\82f\a580\11\c5\8f\aa|\19\e4T\fe\05S\ce\93\d9=|\e4\b9\8a\e6\89e\b9\eb\1c\9d\0eqqA`\c3\06!\d7Yk\fd\bc\a7\e9\e1\0b=\84=e\8f\f3]\d2\15\9e\81\b3s\f6d\04\e9\9b\b8j[\ec\d8\dd\c1\81\04\b6?\03\18\01\a5n\c4o\17\19\a4\d8\8dtx\1a\c6\08j\ad\5ce\b6\c3\ee\12\d6tt\7f\0a\1f\8a\fd\16\a8\10\90\ca\c6\a2\e7\aaq8\8av\10^\e2\93\a7\c4\8fO\c9v\f8/~\ec\95\f3\15\12\17\ef\a2\88z3\cc:\0dS{\a0`\8f\00\00\00\00\8dg\0dI\1a\cf\1a\92\97\a8\17\db\83\83\f4 \0e\e4\f9i\99L\ee\b2\14+\e3\fb\06\07\e9A\8b`\e4\08\1c\c8\f3\d3\91\af\fe\9a\85\84\1da\08\e3\10(\9fK\07\f3\12,\0a\ba\0c\0e\d2\83\81i\df\ca\16\c1\c8\11\9b\a6\c5X\8f\8d&\a3\02\ea+\ea\95B<1\18%1x\0a\09;\c2\87n6\8b\10\c6!P\9d\a1,\19\89\8a\cf\e2\04\ed\c2\ab\93E\d5p\1e\22\d89\af\01e\03\22fhJ\b5\ce\7f\918\a9r\d8,\82\91#\a1\e5\9cj6M\8b\b1\bb*\86\f8\a9\06\8cB$a\81\0b\b3\c9\96\d0>\ae\9b\99*\85xb\a7\e2u+0Jb\f0\bd-o\b9\a3\0f\b7\80.h\ba\c9\b9\c0\ad\124\a7\a0[ \8cC\a0\ad\ebN\e9:CY2\b7$T{\a5\08^\c1(oS\88\bf\c7DS2\a0I\1a&\8b\aa\e1\ab\ec\a7\a8<D\b0s\b1#\bd:^\03\ca\06\d3d\c7OD\cc\d0\94\c9\ab\dd\dd\dd\80>&P\e73o\c7O$\b4J()\fdX\04#G\d5c.\0eB\cb9\d5\cf\ac4\9c\db\87\d7gV\e0\da.\c1H\cd\f5L/\c0\bcR\0d\18\85\dfj\15\ccH\c2\02\17\c5\a5\0f^\d1\8e\ec\a5\5c\e9\e1\ec\cbA\f67F&\fb~T\0a\f1\c4\d9m\fc\8dN\c5\ebV\c3\a2\e6\1f\d7\89\05\e4Z\ee\08\ad\cdF\1fv@!\12?\f1\02\af\05|e\a2L\eb\cd\b5\97f\aa\b8\der\81[%\ff\e6VlhNA\b7\e5)L\fe\f7\05FDzbK\0d\ed\ca\5c\d6`\adQ\9ft\86\b2d\f9\e1\bf-nI\a8\f6\e3.\a5\bf\fd\0c}\86pkp\cf\e7\c3g\14j\a4j]~\8f\89\a6\f3\e8\84\efd@\934\e9'\9e}\fb\0b\94\c7vl\99\8e\e1\c4\8eUl\a3\83\1cx\88`\e7\f5\efm\aebGzu\ef w<\bc\06\94\0d1a\99D\a6\c9\8e\9f+\ae\83\d6?\85`-\b2\e2md%Jz\bf\a8-w\f6\ba\01}L7fp\05\a0\ceg\de-\a9j\979\82\89l\b4\e5\84%#M\93\fe\ae*\9e\b7\b0\08F\8e=oK\c7\aa\c7\5c\1c'\a0QU3\8b\b2\ae\be\ec\bf\e7)D\a8<\a4#\a5u\b6\0f\af\cf;h\a2\86\ac\c0\b5]!\a7\b8\145\8c[\ef\b8\ebV\a6/CA}\a2$L4\13\07\f1\0e\9e`\fcG\09\c8\eb\9c\84\af\e6\d5\90\84\05.\1d\e3\08g\8aK\1f\bc\07,\12\f5\15\00\18O\98g\15\06\0f\cf\02\dd\82\a8\0f\94\96\83\eco\1b\e4\e1&\8cL\f6\fd\01+\fb\b4\1f\09#\8d\92n.\c4\05\c69\1f\88\a14V\9c\8a\d7\ad\11\ed\da\e4\86E\cd?\0b\22\c0v\19\0e\ca\cc\94i\c7\85\03\c1\d0^\8e\a6\dd\17\9a\8d>\ec\17\ea3\a5\80B$~\0d%)7\e2\05^\0bobSB\f8\caD\99u\adI\d0a\86\aa+\ec\e1\a7b{I\b0\b9\f6.\bd\f0\e4\02\b7Jie\ba\03\fe\cd\ad\d8s\aa\a0\91g\81Cj\ea\e6N#}NY\f8\f0)T\b1\ee\0b\8c\88cl\81\c1\f4\c4\96\1ay\a3\9bSm\88x\a8\e0\efu\e1wGb:\fa os\e8\0ce\c9ekh\80\f2\c3\7f[\7f\a4r\12k\8f\91\e9\e6\e8\9c\a0q@\8b{\fc'\862M\04;\08\c0c6AW\cb!\9a\da\ac,\d3\ce\87\cf(C\e0\c2a\d4H\d5\baY/\d8\f3K\03\d2I\c6d\df\00Q\cc\c8\db\dc\ab\c5\92\c8\80&iE\e7+ \d2O<\fb_(1\b2A\0a\e9\8b\ccm\e4\c2[\c5\f3\19\d6\a2\feP\c2\89\1d\abO\ee\10\e2\d8F\079U!\0apG\0d\00\ca\caj\0d\83]\c2\1aX\d0\a5\17\11\c4\8e\f4\eaI\e9\f9\a3\deA\eexS&\e31\00\00\00\00x\0d(\1b\f0\1aP6\88\17x-\e05\a0l\988\88w\10/\f0Zh\22\d8A\c0k@\d9\b8fh\c20q\10\efH|8\f4 ^\e0\b5XS\c8\ae\d0D\b0\83\a8I\98\987\caA\b6O\c7i\ad\c7\d0\11\80\bf\dd9\9b\d7\ff\e1\da\af\f2\c9\c1'\e5\b1\ec_\e8\99\f7\f7\a1\01o\8f\ac)t\07\bbQY\7f\b6yB\17\94\a1\03o\99\89\18\e7\8e\f15\9f\83\d9.\d9\89Bh\a1\84js)\93\12^Q\9e:E9\bc\e2\04A\b1\ca\1f\c9\a6\b22\b1\ab\9a)\19\e2\02\b1a\ef*\aa\e9\f8R\87\91\f5z\9c\f9\d7\a2\dd\81\da\8a\c6\09\cd\f2\ebq\c0\da\f0\eeC\03\de\96N+\c5\1eYS\e8fT{\f3\0ev\a3\b2v{\8b\a9\fel\f3\84\86a\db\9f.(C\07V%k\1c\de2\131\a6?;*\ce\1d\e3k\b6\10\cbp>\07\b3]F\0a\9bF\b2\13\85\d0\ca\1e\ad\cbB\09\d5\e6:\04\fd\fdR&%\bc*+\0d\a7\a2<u\8a\da1]\91rx\c5\09\0au\ed\12\82b\95?\fao\bd$\92Mee\ea@M~bW5S\1aZ\1dH\85\d9\c4f\fd\d4\ec}u\c3\94P\0d\ce\bcKe\ecd\0a\1d\e1L\11\95\f64<\ed\fb\1c'E\b2\84\bf=\bf\ac\a4\b5\a8\d4\89\cd\a5\fc\92\a5\87$\d3\dd\8a\0c\c8U\9dt\e5-\90\5c\fek\9a\c7\b8\13\97\ef\a3\9b\80\97\8e\e3\8d\bf\95\8b\afg\d4\f3\a2O\cf{\b57\e2\03\b8\1f\f9\ab\f1\87a\d3\fc\afz[\eb\d7W#\e6\ffLK\c4'\0d3\c9\0f\16\bb\dew;\c3\d3_ \5cP\86\0e$]\ae\15\acJ\d68\d4G\fe#\bce&b\c4h\0eyL\7fvT4r^O\9c;\c6\d7\e46\ee\ccl!\96\e1\14,\be\fa|\0ef\bb\04\03N\a0\8c\146\8d\f4\19\1e\96\d3:\cb\a5\ab7\e3\be# \9b\93[-\b3\883\0fk\c9K\02C\d2\c3\15;\ff\bb\18\13\e4\13Q\8b|k\5c\a3g\e3K\dbJ\9bF\f3Q\f3d+\10\8bi\03\0b\03~{&{sS=\e4\f0\8a\13\9c\fd\a2\08\14\ea\da%l\e7\f2>\04\c5*\7f|\c8\02d\f4\dfzI\8c\d2RR$\9b\ca\ca\5c\96\e2\d1\d4\81\9a\fc\ac\8c\b2\e7\c4\aej\a6\bc\a3B\bd4\b4:\90L\b9\12\8b\0a\b3\89\cdr\be\a1\d6\fa\a9\d9\fb\82\a4\f1\e0\ea\86)\a1\92\8b\01\ba\1a\9cy\97b\91Q\8c\ca\d8\c9\14\b2\d5\e1\0f:\c2\99\22B\cf\b19*\edixR\e0Ac\da\f79N\a2\fa\11U=y\c8{Et\e0`\cdc\98M\b5n\b0V\ddLh\17\a5A@\0c-V8!U[\10:\fd\12\88\a2\85\1f\a0\b9\0d\08\d8\94u\05\f0\8f\1d'(\cee*\00\d5\ed=x\f8\950P\e3a)Nu\19$fn\913\1eC\e9>6X\81\1c\ee\19\f9\11\c6\02q\06\be/\09\0b\964\a1B\0e\ac\d9O&\b7QX^\9a)Uv\81Aw\ae\c09z\86\db\b1m\fe\f6\c9`\d6\edV\e3\0f\c3.\ee'\d8\a6\f9_\f5\de\f4w\ee\b6\d6\af\af\ce\db\87\b4F\cc\ff\99>\c1\d7\82\96\88O\1a\ee\85g\01f\92\1f,\1e\9f77v\bd\efv\0e\b0\c7m\86\a7\bf@\fe\aa\97[\b8\a0\0c\1d\c0\ad$\06H\ba\5c+0\b7t0X\95\acq \98\84j\a8\8f\fcG\d0\82\d4\5cx\cbL\c4\00\c6d\df\88\d1\1c\f2\f0\dc4\e9\98\fe\ec\a8\e0\f3\c4\b3h\e4\bc\9e\10\e9\94\85\8fjM\ab\f7ge\b0\7fp\1d\9d\07}5\86o_\ed\c7\17R\c5\dc\9fE\bd\f1\e7H\95\eaO\01\0dr7\0c%i\bf\1b]D\c7\16u_\af4\ad\1e\d79\85\05_.\fd('#\d53\00\00\00\00\11hWO\22\d0\ae\9e3\b8\f9\d1\f3\bd\9c9\e2\d5\cbv\d1m2\a7\c0\05e\e8\e6{9s\f7\13n<\c4\ab\97\ed\d5\c3\c0\a2\15\c6\a5J\04\ae\f2\057\16\0b\d4&~\5c\9b\cc\f7r\e6\dd\9f%\a9\ee'\dcx\ffO\8b7?J\ee\df.\22\b9\90\1d\9a@A\0c\f2\17\0e*\8cK\95;\e4\1c\da\08\5c\e5\0b\194\b2D\d91\d7\ac\c8Y\80\e3\fb\e1y2\ea\89.}/\f2$\c8>\9as\87\0d\22\8aV\1cJ\dd\19\dcO\b8\f1\cd'\ef\be\fe\9f\16o\ef\f7A \c9\89\1d\bb\d8\e1J\f4\ebY\b3%\fa1\e4j:4\81\82+\5c\d6\cd\18\e4/\1c\09\8cxS\e3\05V.\f2m\01a\c1\d5\f8\b0\d0\bd\af\ff\10\b8\ca\17\01\d0\9dX2hd\89#\003\c6\05~o]\14\168\12'\ae\c1\c36\c6\96\8c\f6\c3\f3d\e7\ab\a4+\d4\13]\fa\c5{\0a\b5\e9\f9\88\94\f8\91\df\db\cb)&\0a\daAqE\1aD\14\ad\0b,C\e28\94\ba3)\fc\ed|\0f\82\b1\e7\1e\ea\e6\a8-R\1fy<:H6\fc?-\de\edWz\91\de\ef\83@\cf\87\d4\0f%\0e\far4f\ad=\07\deT\ec\16\b6\03\a3\d6\b3fK\c7\db1\04\f4c\c8\d5\e5\0b\9f\9a\c3u\c3\01\d2\1d\94N\e1\a5m\9f\f0\cd:\d00\c8_8!\a0\08w\12\18\f1\a6\03p\a6\e9\c6\0b\ac\5c\d7c\fb\13\e4\db\02\c2\f5\b3U\8d5\b60e$\deg*\17f\9e\fb\06\0e\c9\b4 p\95/1\18\c2`\02\a0;\b1\13\c8l\fe\d3\cd\09\16\c2\a5^Y\f1\1d\a7\88\e0u\f0\c7\0a\fc\de\ba\1b\94\89\f5(,p$9D'k\f9AB\83\e8)\15\cc\db\91\ec\1d\ca\f9\bbR\ec\87\e7\c9\fd\ef\b0\86\ceWIW\df?\1e\18\1f:{\f0\0eR,\bf=\ea\d5n,\82\82!e\ee\d0-t\86\87bG>~\b3VV)\fc\96SL\14\87;\1b[\b4\83\e2\8a\a5\eb\b5\c5\83\95\e9^\92\fd\be\11\a1EG\c0\b0-\10\8fp(uga@\22(R\f8\db\f9C\90\8c\b6\a9\19\a2\cb\b8q\f5\84\8b\c9\0cU\9a\a1[\1aZ\a4>\f2K\cci\bdxt\90li\1c\c7#Ob\9b\b8^\0a\cc\f7m\b25&|\dabi\bc\df\07\81\ad\b7P\ce\9e\0f\a9\1f\8fg\fePJ\1c\f4\e5[t\a3\aah\ccZ{y\a4\0d4\b9\a1h\dc\a8\c9?\93\9bq\c6B\8a\19\91\0d\acg\cd\96\bd\0f\9a\d9\8e\b7c\08\9f\df4G_\daQ\afN\b2\06\e0}\0a\ff1lb\a8~\86\eb\86\03\97\83\d1L\a4;(\9d\b5S\7f\d2uV\1a:d>MuW\86\b4\a4F\ee\e3\eb`\90\bfpq\f8\e8?B@\11\eeS(F\a1\93-#I\82Et\06\b1\fd\8d\d7\a0\95\da\98\8c\17X\b9\9d\7f\0f\f6\ae\c7\f6'\bf\af\a1h\7f\aa\c4\80n\c2\93\cf]zj\1eL\12=Qjla\ca{\046\85H\bc\cfTY\d4\98\1b\99\d1\fd\f3\88\b9\aa\bc\bb\01Sm\aai\04\22@\e0*_Q\88}\10b0\84\c1sX\d3\8e\b3]\b6f\a25\e1)\91\8d\18\f8\80\e5O\b7\a6\9b\13,\b7\f3Dc\84K\bd\b2\95#\ea\fdU&\8f\15DN\d8Zw\f6!\8bf\9ev\c4\a3\e5|q\b2\8d+>\815\d2\ef\90]\85\a0PX\e0HA0\b7\07r\88N\d6c\e0\19\99E\9eE\02T\f6\12MgN\eb\9cv&\bc\d3\b6#\d9;\a7K\8et\94\f3w\a5\85\9b \eao\12\0e\97~zY\d8M\c2\a0\09\5c\aa\f7F\9c\af\92\ae\8d\c7\c5\e1\be\7f<0\af\17k\7f\89i7\e4\98\01`\ab\ab\b9\99z\ba\d1\ce5z\d4\ab\ddk\bc\fc\92X\04\05CIlR\0c\00\00\00\00\ca\dc\a1[\94\b9C\b7^e\e2\ec\9fnFjU\b2\e71\0b\d7\05\dd\c1\0b\a4\86>\dd\8c\d4\f4\01-\8f\aad\cfc`\b8n8\a1\b3\ca\bekok\e55\0a\89\09\ff\d6(R\cb\a7\d8\ad\01{y\f6_\1e\9b\1a\95\c2:AT\c9\9e\c7\9e\15?\9c\c0p\ddp\0a\ac|+\f5zTy?\a6\f5\22a\c3\17\ce\ab\1f\b6\95j\14\12\13\a0\c8\b3H\fe\adQ\a44q\f0\ff!Rp_\eb\8e\d1\04\b5\eb3\e8\7f7\92\b3\be<65t\e0\97n*\85u\82\e0Y\d4\d9\1f\8f\fc\8b\d5S]\d0\8b6\bf<A\ea\1eg\80\e1\ba\e1J=\1b\ba\14X\f9V\de\84X\0d\ea\f5\a8\f2 )\09\a9~L\ebE\b4\90J\1eu\9b\ee\98\bfGO\c3\e1\22\ad/+\fe\0ct\d4($&\1e\f4\85}@\91g\91\8aM\c6\caKFbL\81\9a\c3\17\df\ff!\fb\15#\80\a0B\a4\e0\be\88xA\e5\d6\1d\a3\09\1c\c1\02R\dd\ca\a6\d4\17\16\07\8fIs\e5c\83\afD8|ylj\b6\a5\cd1\e8\c0/\dd\22\1c\8e\86\e3\17*\00)\cb\8b[w\aei\b7\bdr\c8\ec\89\038\13C\df\99H\1d\ba{\a4\d7f\da\ff\16m~y\dc\b1\df\22\82\d4=\ceH\08\9c\95\b7\de\b4\c7}\02\15\9c#g\f7p\e9\bbV+(\b0\f2\ad\e2lS\f6\bc\09\b1\1av\d5\10Ac\f6\90\e1\a9*1\ba\f7O\d3V=\93r\0d\fc\98\d6\8b6Dw\d0h!\95<\a2\fd4g]+\1c5\97\f7\bdn\c9\92_\82\03N\fe\d9\c2EZ_\08\99\fb\04V\fc\19\e8\9c \b8\b3\a8QHLb\8d\e9\17<\e8\0b\fb\f64\aa\a07?\0e&\fd\e3\af}\a3\86M\91iZ\ec\ca\96\8c\c4\98\5cPe\c3\025\87/\c8\e9&t\09\e2\82\f2\c3>#\a9\9d[\c1EW\87`\1e3U\00y\f9\89\a1\22\a7\ecC\cem0\e2\95\ac;F\13f\e7\e7H8\82\05\a4\f2^\a4\ff\0d\88\8c\ad\c7T-\f6\991\cf\1aS\ednA\92\e6\ca\c7X:k\9c\06_\89p\cc\83(+\f8\f2\d8\d42.y\8flK\9bc\a6\97:8g\9c\9e\be\ad@?\e5\f3%\dd\099\f9|R\c6/T\00\0c\f3\f5[R\96\17\b7\98J\b6\ecYA\12j\93\9d\b31\cd\f8Q\dd\07$\f0\86\12\07p&\d8\db\d1}\86\be3\91Lb\92\ca\8di6LG\b5\97\17\19\d0u\fb\d3\0c\d4\a0,\da\fc\f2\e6\06]\a9\b8c\bfEr\bf\1e\1e\b3\b4\ba\98yh\1b\c3'\0d\f9/\ed\d1Xt\d9\a0\a8\8b\13|\09\d0M\19\eb<\87\c5JgF\ce\ee\e1\8c\12O\ba\d2w\adV\18\ab\0c\0d\e7}$_-\a1\85\04s\c4g\e8\b9\18\c6\b3x\13b5\b2\cf\c3n\ec\aa!\82&v\80\d9q\f1\e0\c7\bb-A\9c\e5H\a3p/\94\02+\ee\9f\a6\ad$C\07\f6z&\e5\1a\b0\faDAO,l\13\85\f0\cdH\db\95/\a4\11I\8e\ff\d0B*y\1a\9e\8b\22D\fbi\ce\8e'\c8\95\baV8jp\8a\991.\ef{\dd\e43\da\86%8~\00\ef\e4\df[\b1\81=\b7{]\9c\ec\84\8b\b4\beNW\15\e5\102\f7\09\da\eeVR\1b\e5\f2\d4\d19S\8f\8f\5c\b1cE\80\108P\a3\90\98\9a\7f1\c3\c4\1a\d3/\0e\c6rt\cf\cd\d6\f2\05\11w\a9[t\95E\91\a84\1en~\1cL\a4\a2\bd\17\fa\c7_\fb0\1b\fe\a0\f1\10Z&;\cc\fb}e\a9\19\91\afu\b8\ca\9b\04H5Q\d8\e9n\0f\bd\0b\82\c5a\aa\d9\04j\0e_\ce\b6\af\04\90\d3M\e8Z\0f\ec\b3\a5\d9\c4\e1o\05e\ba1`\87V\fb\bc&\0d:\b7\82\8b\f0k#\d0\ae\0e\c1<d\d2`g\00\00\00\00\01\00\00\00\03\00\00\00\07\00\00\00\0f\00\00\00\1f\00\00\00?\00\00\00\7f\00\00\00\ff\00\00\00\ff\01\00\00\ff\03\00\00\ff\07\00\00\ff\0f\00\00\ff\1f\00\00\ff?\00\00\ff\7f\00\00\ff\ff\00\00\ff\ff\01\00\ff\ff\03\00\ff\ff\07\00\ff\ff\0f\00\ff\ff\1f\00\ff\ff?\00\ff\ff\7f\00\ff\ff\ff\00\ff\ff\ff\01\ff\ff\ff\03\ff\ff\ff\07\ff\ff\ff\0f\ff\ff\ff\1f\ff\ff\ff?\ff\ff\ff\7f\ff\ff\ff\ff")
  (data (;1;) (i32.const 16798352) "\00\00\00\00\90R\00\01\90R\00\01\00\00\00\00\00\00\00\00\a0R\00\01\a0R\00\01\00\00\00\00\00\00\00\00\b0R\00\01\b0R\00\01\00\00\00\00\00\00\00\00\c0R\00\01\c0R\00\01\00\00\00\00\00\00\00\00\d0R\00\01\d0R\00\01\00\00\00\00\00\00\00\00\e0R\00\01\e0R\00\01\00\00\00\00\00\00\00\00\f0R\00\01\f0R\00\01\00\00\00\00\00\00\00\00\00S\00\01\00S\00\01\00\00\00\00\00\00\00\00\10S\00\01\10S\00\01\00\00\00\00\00\00\00\00 S\00\01 S\00\01\00\00\00\00\00\00\00\000S\00\010S\00\01\00\00\00\00\00\00\00\00@S\00\01@S\00\01\00\00\00\00\00\00\00\00PS\00\01PS\00\01\00\00\00\00\00\00\00\00`S\00\01`S\00\01\00\00\00\00\00\00\00\00pS\00\01pS\00\01\00\00\00\00\00\00\00\00\80S\00\01\80S\00\01\00\00\00\00\00\00\00\00\90S\00\01\90S\00\01\00\00\00\00\00\00\00\00\a0S\00\01\a0S\00\01\00\00\00\00\00\00\00\00\b0S\00\01\b0S\00\01\00\00\00\00\00\00\00\00\c0S\00\01\c0S\00\01\00\00\00\00\00\00\00\00\d0S\00\01\d0S\00\01\00\00\00\00\00\00\00\00\e0S\00\01\e0S\00\01\00\00\00\00\00\00\00\00\f0S\00\01\f0S\00\01\00\00\00\00\00\00\00\00\00T\00\01\00T\00\01\00\00\00\00\00\00\00\00\10T\00\01\10T\00\01\00\00\00\00\00\00\00\00 T\00\01 T\00\01\00\00\00\00\00\00\00\000T\00\010T\00\01\00\00\00\00\00\00\00\00@T\00\01@T\00\01\00\00\00\00\00\00\00\00PT\00\01PT\00\01\00\00\00\00\00\00\00\00`T\00\01`T\00\01\00\00\00\00\00\00\00\00pT\00\01pT\00\01\00\00\00\00\00\00\00\00\80T\00\01\80T\00\01\00\00\00\00\00\00\00\00\90T\00\01\90T\00\01\00\00\00\00\00\00\00\00\a0T\00\01\a0T\00\01\00\00\00\00\00\00\00\00\b0T\00\01\b0T\00\01\00\00\00\00\00\00\00\00\c0T\00\01\c0T\00\01\00\00\00\00\00\00\00\00\d0T\00\01\d0T\00\01\00\00\00\00\00\00\00\00\e0T\00\01\e0T\00\01\00\00\00\00\00\00\00\00\f0T\00\01\f0T\00\01\00\00\00\00\00\00\00\00\00U\00\01\00U\00\01\00\00\00\00\00\00\00\00\10U\00\01\10U\00\01\00\00\00\00\00\00\00\00 U\00\01 U\00\01\00\00\00\00\00\00\00\000U\00\010U\00\01\00\00\00\00\00\00\00\00@U\00\01@U\00\01\00\00\00\00\00\00\00\00PU\00\01PU\00\01\00\00\00\00\00\00\00\00`U\00\01`U\00\01\00\00\00\00\00\00\00\00pU\00\01pU\00\01\00\00\00\00\00\00\00\00\80U\00\01\80U\00\01\00\00\00\00\00\00\00\00\90U\00\01\90U\00\01\00\00\00\00\00\00\00\00\a0U\00\01\a0U\00\01\00\00\00\00\00\00\00\00\b0U\00\01\b0U\00\01\00\00\00\00\00\00\00\00\c0U\00\01\c0U\00\01\00\00\00\00\00\00\00\00\d0U\00\01\d0U\00\01\00\00\00\00\00\00\00\00\e0U\00\01\e0U\00\01\00\00\00\00\00\00\00\00\f0U\00\01\f0U\00\01\00\00\00\00\00\00\00\00\00V\00\01\00V\00\01\00\00\00\00\00\00\00\00\10V\00\01\10V\00\01\00\00\00\00\00\00\00\00 V\00\01 V\00\01\00\00\00\00\00\00\00\000V\00\010V\00\01\00\00\00\00\00\00\00\00@V\00\01@V\00\01\00\00\00\00\00\00\00\00PV\00\01PV\00\01\00\00\00\00\00\00\00\00`V\00\01`V\00\01\00\00\00\00\00\00\00\00pV\00\01pV\00\01\00\00\00\00\00\00\00\00\80V\00\01\80V\00\01\00\00\00\00\09\00\00\00\0a\00\00\00\0b\00\00\00\0c\00\00\00\0d\00\00\00\0e\00\00\00\0f\00\00\00\10\00\00\00\11\00\00\00\12\00\00\00\13\00\00\00\14\00\00\00\15\00\00\00\16\00\00\00\17\00\00\00\18\00\00\00\19\00\00\00\15\00\00\00\16\00\00\00\17\00\00\00\18\00\00\00\1a\00\00\00\15\00\00\00\16\00\00\00\17\00\00\00\18\00\00\00\1b\00\00\00")
  (@custom "name" "\01\f2\0aS\00\13wasi_fd_prestat_get\01\18wasi_fd_prestat_dir_name\02\0ewasi_proc_exit\03\0fwasi_random_get\04\11__wasm_call_ctors\05\0b_initialize\06\06decode\07\08mem_seek\08\06memset\09\08mem_read\0a\06calloc\0b\0fogg_stream_init\0c\0e_fetch_headers\0d\08ov_clear\0e\06memcpy\0f\04free\10\12_initial_pcmoffset\11\15_get_prev_page_serial\12\18_bisect_forward_serialno\13\10vorbis_dsp_clear\14\12vorbis_block_clear\15\17vorbis_packet_blocksize\16\14ogg_stream_packetout\17\0e_get_next_page\18\0cov_pcm_total\19\11ogg_stream_pagein\1a\06malloc\1b\07ov_read\1c\09mem_close\1d\08mem_tell\1e\07release\1f\11emmalloc_memalign \19emmalloc_attempt_allocate!\07realloc\22\15vorbis_synthesis_init#\17vorbis_book_init_decode$\0dmapping0_look%\12mapping0_free_look&\14vorbis_comment_clear'\11vorbis_info_clear(\12mapping0_free_info)\19vorbis_synthesis_headerin*\13_vorbis_unpack_info+\16_vorbis_unpack_comment,\14_vorbis_unpack_books-\0coggpack_read.\18_book_maptype1_quantvals/\0fmapping0_unpack0\0dfloor1_unpack1\0cfloor1_icomp2\05qsort3\0bfloor1_look4\10floor1_free_info5\10floor1_free_look6\0ffloor1_inverse17\1adecode_packed_entry_number8\0ffloor1_inverse29\0dqsort_trinkle:\13vorbis_lsp_to_curve;\0dfloor0_unpack<\0bfloor0_look=\10floor0_free_info>\10floor0_free_look?\0ffloor0_inverse1@\0ffloor0_inverse2A\0e_os_update_crcB\07memmoveC\10vorbis_synthesisD\10__wasi_proc_exitE\1c__wasilibc_populate_preopensF\05_ExitG\0eres0_free_infoH\0eres0_free_lookI\0bres0_unpackJ\09res0_lookK\0cres0_inverseL\18vorbis_book_decodevs_addM\0a_01inverseN\0cres1_inverseO\17vorbis_book_decodev_addP\0cres2_inverseQ\12sharedbook_sort32aR\12__init_random_seed\07\12\01\00\0f__stack_pointer"))
